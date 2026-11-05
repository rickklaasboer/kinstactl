import {describe, expect, test} from 'bun:test';
import {runCli} from '../../helpers/runCli';

const sites = {
    'GET /sites': {
        body: {
            company: {
                sites: [
                    {
                        id: 'id-x',
                        name: 'klant-x',
                        display_name: 'Klant X',
                        status: 'live',
                        environments: [
                            {
                                id: 'env-live',
                                name: 'live',
                                display_name: 'Live',
                            },
                            {
                                id: 'env-stg',
                                name: 'staging',
                                display_name: 'Staging',
                            },
                        ],
                    },
                ],
            },
        },
    },
};

const envs = (cdn: string | null) => ({
    'GET /sites/id-x/environments': {
        body: {
            site: {
                environments: [
                    {id: 'env-live', cdn_cache_id: cdn},
                    {id: 'env-stg', cdn_cache_id: null},
                ],
            },
        },
    },
});

const started = (id: string) => ({
    body: {operation_id: id, message: 'started'},
});

describe('cache clear', () => {
    test('sends the environment id and completes', async () => {
        const r = await runCli(
            ['cache', 'clear', 'klant-x', '--env', 'live', '--json'],
            {
                routes: {
                    ...sites,
                    'POST /sites/tools/clear-cache': started('op1'),
                    'GET /operations/op1': {status: 200},
                },
            },
        );
        expect(r.code).toBe(0);
        const post = r.calls.find((c) => c.method === 'POST')!;
        expect(post.url.pathname).toBe('/v2/sites/tools/clear-cache');
        expect(post.body).toEqual({environment_id: 'env-live'});
        expect(JSON.parse(r.stdout)).toEqual({
            operation_id: 'op1',
            status: 'completed',
        });
    });

    test('cache clear without a site opens the site picker on a TTY', async () => {
        let searchCalls = 0;
        const r = await runCli(['cache', 'clear', '--env', 'live'], {
            tty: true,
            prompts: {
                search: (async (
                    _message: string,
                    options: {value: unknown; label: string}[],
                ) => {
                    searchCalls++;
                    return options.find((o) => o.label.includes('klant-x'))!
                        .value;
                }) as never,
            },
            routes: {
                ...sites,
                'POST /sites/tools/clear-cache': started('op1'),
                'GET /operations/op1': {status: 200},
            },
        });
        expect(r.code).toBe(0);
        expect(searchCalls).toBe(1);
        const post = r.calls.find((c) => c.method === 'POST')!;
        expect(post.body).toEqual({environment_id: 'env-live'});
    });

    test('cache clear without a site fails without a TTY', async () => {
        const r = await runCli(['cache', 'clear', '--env', 'live']);
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('Missing <site>');
    });

    test('several environments without --env exits 2', async () => {
        const r = await runCli(['cache', 'clear', 'klant-x', '--json'], {
            routes: sites,
        });
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('ENV_REQUIRED');
    });
});

describe('cache edge clear', () => {
    test('passes url and subdirectories', async () => {
        const r = await runCli(
            [
                'cache',
                'edge',
                'clear',
                'klant-x',
                '--env',
                'live',
                '--url',
                'https://example.com/blog/',
                '--subdirectories',
                '--dry-run',
                '--json',
            ],
            {routes: sites},
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout).request.body).toEqual({
            environment_id: 'env-live',
            url: 'https://example.com/blog/',
            clear_subdirectories: true,
        });
    });
});

describe('cache cdn clear', () => {
    test('sends the cdn_cache_id of the environment', async () => {
        const r = await runCli(
            ['cache', 'cdn', 'clear', 'klant-x', '--env', 'live', '--json'],
            {
                routes: {
                    ...sites,
                    ...envs('cdn-1'),
                    'POST /sites/cdn/clear-cache': started('op2'),
                    'GET /operations/op2': {status: 200},
                },
            },
        );
        expect(r.code).toBe(0);
        const post = r.calls.find((c) => c.method === 'POST')!;
        expect(post.body).toEqual({
            environment_id: 'env-live',
            cdn_cache_id: 'cdn-1',
        });
    });

    test('a null cdn_cache_id is a usage error', async () => {
        const r = await runCli(
            ['cache', 'cdn', 'clear', 'klant-x', '--env', 'staging', '--json'],
            {routes: {...sites, ...envs('cdn-1')}},
        );
        expect(r.code).toBe(2);
        const err = JSON.parse(r.stderr).error;
        expect(err.code).toBe('USAGE');
        expect(err.message).toBe('CDN is not enabled for klant-x (staging)');
        expect(r.calls.some((c) => c.method === 'POST')).toBe(false);
    });
});

describe('help', () => {
    test('every cache command has an example', async () => {
        for (const argv of [
            ['cache', 'clear'],
            ['cache', 'edge', 'clear'],
            ['cache', 'cdn', 'clear'],
        ]) {
            const r = await runCli([...argv, '--help']);
            expect(r.stdout).toContain('Examples:');
        }
    });
});
