import {describe, expect, test} from 'bun:test';
import {runCli} from '../../helpers/runCli';

const sitesBody = {
    company: {
        sites: [
            {
                id: 'id-x',
                name: 'klant-x',
                display_name: 'Klant X',
                status: 'live',
                environments: [
                    {id: 'env-live', name: 'live', display_name: 'Live'},
                    {id: 'env-stg', name: 'staging', display_name: 'Staging'},
                ],
            },
        ],
    },
};

const item = (name: string, over: Record<string, unknown> = {}) => ({
    name,
    title: name,
    status: 'active',
    version: '1.0',
    update: 'none',
    update_version: null,
    update_status: null,
    is_version_vulnerable: false,
    is_update_version_vulnerable: false,
    auto_update_type: null,
    ...over,
});

const pluginsBody = {
    environment: {
        plugins: {
            items: [
                item('akismet', {
                    version: '5.2',
                    update: 'available',
                    update_version: '5.3',
                }),
                item('hello-dolly', {is_version_vulnerable: true}),
                item('yoast', {
                    version: '22.0',
                    update: 'available',
                    update_version: '22.1',
                }),
            ],
            last_updated_at: '2026-01-01T12:00:00Z',
        },
    },
};

const themesBody = {
    environment: {
        themes: {
            items: [
                item('twentytwentyfour', {
                    update: 'available',
                    update_version: '1.1',
                }),
            ],
            last_updated_at: '2026-01-01T12:00:00Z',
        },
    },
};

const routes = {
    'GET /sites': {body: sitesBody},
    'GET /sites/environments/env-live/wp-plugins': {body: pluginsBody},
    'GET /sites/environments/env-live/wp-themes': {body: themesBody},
};

describe('plugins list', () => {
    test('marks a vulnerable plugin and an available update', async () => {
        const r = await runCli(
            ['plugins', 'list', 'klant-x', '--env', 'live'],
            {
                routes,
            },
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('NAME');
        expect(r.stdout).toContain('VULNERABLE');
        expect(r.stdout).toMatch(/hello-dolly.*yes/);
        expect(r.stdout).toContain('5.3');
    });

    test('--updates filters to items with an update', async () => {
        const r = await runCli(
            ['plugins', 'list', 'klant-x', '--env', 'live', '--updates'],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('akismet');
        expect(r.stdout).toContain('yoast');
        expect(r.stdout).not.toContain('hello-dolly');
    });

    test('--json prints the items', async () => {
        const r = await runCli(
            ['plugins', 'list', 'klant-x', '--env', 'live', '--json'],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toHaveLength(3);
    });
});

describe('plugins update', () => {
    test('one name sends the update_version from the list', async () => {
        const r = await runCli(
            [
                'plugins',
                'update',
                'klant-x',
                'akismet',
                '--env',
                'live',
                '--json',
            ],
            {
                routes: {
                    ...routes,
                    'PUT /sites/environments/env-live/plugins': {
                        status: 202,
                        body: {operation_id: 'op1', message: 'ok', status: 202},
                    },
                    'GET /operations/op1': {status: 200},
                },
            },
        );
        expect(r.code).toBe(0);
        const put = r.calls.find((c) => c.method === 'PUT');
        expect(put?.body).toEqual({name: 'akismet', update_version: '5.3'});
    });

    test('a name without an update is a usage error', async () => {
        const r = await runCli(
            ['plugins', 'update', 'klant-x', 'hello-dolly', '--env', 'live'],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('already up to date');
    });

    test('an unknown name is a usage error', async () => {
        const r = await runCli(
            ['plugins', 'update', 'klant-x', 'nope', '--env', 'live'],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('plugin not found: nope');
    });

    test('neither name nor --all is a usage error with a hint', async () => {
        const r = await runCli(
            ['plugins', 'update', 'klant-x', '--env', 'live', '--json'],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.hints).toContain(
            'pass a plugin name or --all',
        );
    });

    test('--all --dry-run lists only updatable items', async () => {
        const r = await runCli(
            [
                'plugins',
                'update',
                'klant-x',
                '--all',
                '--env',
                'live',
                '--dry-run',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        const out = JSON.parse(r.stdout);
        expect(out.request.path).toBe(
            '/sites/environments/env-live/plugins/bulk-update',
        );
        expect(out.request.body).toEqual({
            plugins: [{name: 'akismet'}, {name: 'yoast'}],
        });
        expect(r.calls.some((c) => c.method === 'PUT')).toBe(false);
    });

    test('--all with nothing to update is a no-op', async () => {
        const r = await runCli(
            ['plugins', 'update', 'klant-x', '--all', '--env', 'live'],
            {
                routes: {
                    ...routes,
                    'GET /sites/environments/env-live/wp-plugins': {
                        body: {
                            environment: {
                                plugins: {
                                    items: [item('a')],
                                    last_updated_at: 'x',
                                },
                            },
                        },
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.calls.some((c) => c.method === 'PUT')).toBe(false);
    });
});

describe('themes', () => {
    test('list hits wp-themes', async () => {
        const r = await runCli(['themes', 'list', 'klant-x', '--env', 'live'], {
            routes,
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('twentytwentyfour');
        expect(
            r.calls.some((c) => c.url.pathname.endsWith('/env-live/wp-themes')),
        ).toBe(true);
    });

    test('--all --dry-run uses the themes bulk endpoint', async () => {
        const r = await runCli(
            [
                'themes',
                'update',
                'klant-x',
                '--all',
                '--env',
                'live',
                '--dry-run',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        const out = JSON.parse(r.stdout);
        expect(out.request.path).toBe(
            '/sites/environments/env-live/themes/bulk-update',
        );
        expect(out.request.body).toEqual({
            themes: [{name: 'twentytwentyfour'}],
        });
    });
});
