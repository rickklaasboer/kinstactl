import {describe, expect, test} from 'bun:test';
import {createContainer} from '@/cli/container';
import {CliError} from '@/cli/errors';
import type {Io} from '@/cli/io';
import type {Prompts} from '@/cli/prompts';
import {redactKeys, SecretInput} from '@/cli/services/SecretInput';

const opts = {flag: '--admin-password', label: 'admin password'};

function setup(o: {tty?: boolean; stdin?: string; prompts?: Partial<Prompts>}) {
    const io: Io = {
        stdout() {},
        stderr() {},
        isTTY: o.tty ?? false,
        env: {},
        progressOutput: process.stderr,
        prompts: (o.prompts ?? {}) as Prompts,
        stdin: o.stdin === undefined ? undefined : async () => o.stdin!,
    };
    return createContainer(io).resolve(SecretInput);
}

async function failure(p: Promise<unknown>): Promise<CliError> {
    try {
        await p;
    } catch (e) {
        expect(e).toBeInstanceOf(CliError);
        return e as CliError;
    }
    throw new Error('expected a CliError');
}

describe('SecretInput.read', () => {
    test('returns a literal value', async () => {
        expect(await setup({}).read('s3cret', opts)).toBe('s3cret');
    });

    test('- reads stdin', async () => {
        expect(await setup({stdin: ' s3cret\n'}).read('-', opts)).toBe(
            's3cret',
        );
    });

    test('- with empty stdin is a usage error', async () => {
        const e = await failure(setup({stdin: '\n'}).read('-', opts));
        expect(e.code).toBe('USAGE');
        expect(e.message).toBe('stdin is empty; expected admin password');
    });

    test('prompts secretly on a TTY', async () => {
        let seen: unknown;
        const input = setup({
            tty: true,
            prompts: {
                text: async (_m, o) => {
                    seen = o;
                    return 'typed';
                },
            },
        });
        expect(await input.read(undefined, opts)).toBe('typed');
        expect(seen).toEqual({secret: true});
    });

    test('fails without a TTY and without a value', async () => {
        const e = await failure(setup({}).read(undefined, opts));
        expect(e.code).toBe('USAGE');
        expect(e.message).toBe(
            'No admin password given and prompting is disabled',
        );
        expect(e.hints[0]).toContain('--admin-password -');
    });
});

describe('redactKeys', () => {
    test('masks present keys only', () => {
        const body = {admin_password: 'x', name: 'n'};
        expect(redactKeys('admin_password', 'custom_ssl_key')(body)).toEqual({
            admin_password: '***',
            name: 'n',
        });
        expect(body.admin_password).toBe('x');
    });
});
