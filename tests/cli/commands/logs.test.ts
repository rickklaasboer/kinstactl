import {describe, expect, test} from 'bun:test';
import {runCli} from '../../helpers/runCli';

const env = (id: string, name: string, display: string) => ({
    id,
    name,
    display_name: display,
});

const sitesBody = {
    company: {
        sites: [
            {
                id: 'id-x',
                name: 'klant-x',
                display_name: 'Klant X',
                status: 'live',
                environments: [
                    env('env-x-live', 'live', 'Live'),
                    env('env-x-staging', 'staging', 'Staging'),
                ],
            },
        ],
    },
};

const logBody = {
    environment: {
        container_info: {logs: 'line one\nline two\n'},
    },
};

const routes = {
    'GET /sites': {body: sitesBody},
    'GET /sites/environments/env-x-live/logs': {body: logBody},
};

describe('logs', () => {
    test('defaults to the error log with 1000 lines', async () => {
        const r = await runCli(['logs', 'klant-x', '--env', 'live'], {routes});
        expect(r.code).toBe(0);
        const call = r.calls.find((c) => c.url.pathname.endsWith('/logs'))!;
        expect(call.url.searchParams.get('file_name')).toBe('error');
        expect(call.url.searchParams.get('lines')).toBe('1000');
    });

    test('cache maps to kinsta-cache-perf and honors --lines', async () => {
        const r = await runCli(
            ['logs', 'klant-x', 'cache', '--env', 'live', '--lines', '50'],
            {routes},
        );
        expect(r.code).toBe(0);
        const call = r.calls.find((c) => c.url.pathname.endsWith('/logs'))!;
        expect(call.url.searchParams.get('file_name')).toBe(
            'kinsta-cache-perf',
        );
        expect(call.url.searchParams.get('lines')).toBe('50');
    });

    test('passes search, from and to', async () => {
        const r = await runCli(
            [
                'logs',
                'klant-x',
                'access',
                '--env',
                'live',
                '--search',
                'wp-login',
                '--from',
                '2026-11-01T00:00:00Z',
                '--to',
                '2026-11-02T00:00:00Z',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        const q = r.calls.find((c) => c.url.pathname.endsWith('/logs'))!.url
            .searchParams;
        expect(q.get('file_name')).toBe('access');
        expect(q.get('search')).toBe('wp-login');
        expect(q.get('from')).toBe('2026-11-01T00:00:00Z');
        expect(q.get('to')).toBe('2026-11-02T00:00:00Z');
    });

    test('--lines above 20000 is a usage error', async () => {
        const r = await runCli(
            ['logs', 'klant-x', '--env', 'live', '--lines', '30000'],
            {routes},
        );
        expect(r.code).toBe(2);
    });

    test('an unknown log type is a usage error', async () => {
        const r = await runCli(['logs', 'klant-x', 'nginx', '--env', 'live'], {
            routes,
        });
        expect(r.code).toBe(2);
    });

    test('human output is the raw log text', async () => {
        const r = await runCli(['logs', 'klant-x', '--env', 'live'], {routes});
        expect(r.stdout).toBe('line one\nline two\n');
    });

    test('--json prints the API payload', async () => {
        const r = await runCli(['logs', 'klant-x', '--env', 'live', '--json'], {
            routes,
        });
        expect(JSON.parse(r.stdout)).toEqual(logBody);
    });

    test('a response without log text is an error', async () => {
        const r = await runCli(['logs', 'klant-x', '--env', 'live'], {
            routes: {
                'GET /sites': {body: sitesBody},
                'GET /sites/environments/env-x-live/logs': {body: {}},
            },
        });
        expect(r.code).toBe(1);
        expect(r.stderr).toContain('log');
    });
});
