import {describe, expect, test} from 'bun:test';
import {CommanderError} from 'commander';
import {CliError, type ErrorCode, toCliError} from '@/cli/errors';
import {
    KinstaApiError,
    OperationFailedError,
    OperationTimeoutError,
} from '@/client/errors';
import {runCli} from '../helpers/runCli';

describe('toCliError', () => {
    test('maps a 401 to AUTH_INVALID with a login hint', () => {
        const e = toCliError(new KinstaApiError(401, 'Unauthorized'));
        expect(e.code).toBe('AUTH_INVALID');
        expect(e.hints).toContain('Run: kinstactl auth login');
    });

    test('maps other API errors to API_ERROR', () => {
        const e = toCliError(new KinstaApiError(500, 'boom'));
        expect([e.code, e.message, e.exitCode]).toEqual([
            'API_ERROR',
            'boom',
            1,
        ]);
    });

    test('maps operation errors', () => {
        expect(toCliError(new OperationFailedError('op1', 'failed')).code).toBe(
            'OPERATION_FAILED',
        );
        expect(toCliError(new OperationTimeoutError('op1', 'slow')).code).toBe(
            'OPERATION_TIMEOUT',
        );
    });

    test('maps commander errors to USAGE without the "error: " prefix', () => {
        const e = toCliError(
            new CommanderError(
                1,
                'commander.unknownOption',
                "error: unknown option '--x'",
            ),
        );
        expect([e.code, e.message]).toEqual(['USAGE', "unknown option '--x'"]);
    });

    test('passes a CliError through and wraps anything else as INTERNAL', () => {
        const cli = new CliError('SITE_NOT_FOUND', 'nope');
        expect(toCliError(cli)).toBe(cli);
        const internal = toCliError(new Error('unexpected'));
        expect([internal.code, internal.message, internal.exitCode]).toEqual([
            'INTERNAL',
            'Unexpected error: unexpected',
            1,
        ]);
        expect(toCliError('str').message).toBe('Unexpected error: str');
    });
});

describe('unexpected errors in a command', () => {
    const throwing = {
        now: () => {
            throw new TypeError('boom');
        },
    };
    // Resolving a site writes the site cache, which reads the (throwing) clock.
    const args = ['sites', 'get', 'klant-x'];
    const routes = {'GET /sites': {body: {company: {sites: []}}}};

    test('human mode prints the message and the stack on stderr', async () => {
        const r = await runCli(args, {routes, io: throwing});
        expect(r.code).toBe(1);
        expect(r.stderr).toContain('Unexpected error: boom');
        expect(r.stderr).toContain('TypeError: boom');
        expect(r.stderr).toContain('    at ');
    });

    test('json mode reports INTERNAL without a stack by default', async () => {
        const r = await runCli([...args, '--json'], {routes, io: throwing});
        expect(r.code).toBe(1);
        const {error} = JSON.parse(r.stderr);
        expect(error.code).toBe('INTERNAL');
        expect(error.stack).toBeUndefined();
    });

    test('json mode includes the stack when KINSTACTL_DEBUG=1', async () => {
        const r = await runCli([...args, '--json'], {
            routes,
            io: throwing,
            env: {KINSTACTL_DEBUG: '1'},
        });
        expect(JSON.parse(r.stderr).error.stack).toContain('TypeError: boom');
    });
});

describe('CliError exit codes', () => {
    const table: Array<[ErrorCode, number]> = [
        ['USAGE', 2],
        ['AUTH_MISSING', 2],
        ['SITE_NOT_FOUND', 2],
        ['SITE_AMBIGUOUS', 2],
        ['ENV_REQUIRED', 2],
        ['ENV_NOT_FOUND', 2],
        ['API_ERROR', 1],
        ['INTERNAL', 1],
        ['AUTH_INVALID', 1],
        ['OPERATION_FAILED', 3],
        ['OPERATION_TIMEOUT', 4],
        ['CONFIRMATION_REQUIRED', 5],
        ['CONFIRMATION_DECLINED', 5],
    ];
    for (const [code, exit] of table) {
        test(`${code} exits ${exit}`, () => {
            expect(new CliError(code, 'm').exitCode).toBe(exit);
        });
    }

    test('keeps message, code and hints', () => {
        const e = new CliError('USAGE', 'bad', ['try this']);
        expect(e).toBeInstanceOf(Error);
        expect([e.message, e.code, e.hints]).toEqual([
            'bad',
            'USAGE',
            ['try this'],
        ]);
        expect(new CliError('USAGE', 'bad').hints).toEqual([]);
    });
});
