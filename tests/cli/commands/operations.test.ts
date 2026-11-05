import {describe, expect, test} from 'bun:test';
import {runCli} from '../../helpers/runCli';

describe('operations get', () => {
    test('200 is completed', async () => {
        const r = await runCli(['operations', 'get', 'op1', '--json'], {
            routes: {'GET /operations/op1': {status: 200}},
        });
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual({
            operation_id: 'op1',
            status: 'completed',
        });
    });

    test('202 is pending', async () => {
        const r = await runCli(['operations', 'get', 'op1', '--json'], {
            routes: {'GET /operations/op1': {status: 202}},
        });
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout).status).toBe('pending');
    });

    test('500 is failed with exit 3 and the Kinsta message', async () => {
        const r = await runCli(['operations', 'get', 'op1'], {
            routes: {
                'GET /operations/op1': {
                    status: 500,
                    body: {message: 'Cache clear failed'},
                },
            },
        });
        expect(r.code).toBe(3);
        expect(r.stderr).toContain('Cache clear failed');
    });

    test('404 is a usage error', async () => {
        const r = await runCli(['operations', 'get', 'nope', '--json'], {
            routes: {'GET /operations/nope': {status: 404, body: {}}},
        });
        expect(r.code).toBe(2);
        const err = JSON.parse(r.stderr).error;
        expect(err.code).toBe('USAGE');
        expect(err.message).toContain('operation not found');
    });
});

describe('operations wait', () => {
    test('polls until completed', async () => {
        const r = await runCli(['operations', 'wait', 'op1', '--json'], {
            routes: {'GET /operations/op1': [{status: 202}, {status: 200}]},
        });
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual({
            operation_id: 'op1',
            status: 'completed',
        });
    });

    test('a failed operation exits 3', async () => {
        const r = await runCli(['operations', 'wait', 'op1', '--json'], {
            routes: {
                'GET /operations/op1': {status: 500, body: {message: 'boom'}},
            },
        });
        expect(r.code).toBe(3);
    });

    test('rejects a non-positive --timeout', async () => {
        const r = await runCli(
            ['operations', 'wait', 'op1', '--timeout', '0', '--json'],
            {routes: {}},
        );
        expect(r.code).toBe(2);
    });
});
