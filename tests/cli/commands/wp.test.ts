import {describe, expect, test} from 'bun:test';
import {runCli} from '../../helpers/runCli';

const sites = {
    'GET /sites': {
        body: {
            company: {
                sites: [
                    {
                        id: 'id-x',
                        name: 'my-site',
                        display_name: 'My Site',
                        status: 'live',
                        environments: [
                            {
                                id: 'env-live',
                                name: 'live',
                                display_name: 'Live',
                            },
                        ],
                    },
                ],
            },
        },
    },
};

const posts = (calls: {method: string}[]) =>
    calls.filter((c) => c.method !== 'GET');

describe('wp run', () => {
    const route = {
        'POST /sites/environments/env-live/run-wp-cli-command': {
            body: {operation_id: 'op1', message: 'started', status: 202},
        },
        'GET /operations/op1': {
            status: 200,
            body: {message: 'ok', status: 200, data: 'akismet 5.3'},
        },
    };

    test('rejects a command without the wp prefix', async () => {
        const r = await runCli(
            ['wp', 'run', 'my-site', 'plugin list', '--yes', '--json'],
            {routes: {...sites, ...route}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(r.calls).toHaveLength(0);
    });

    test('needs --yes', async () => {
        const r = await runCli(['wp', 'run', 'my-site', 'wp plugin list'], {
            routes: {...sites, ...route},
        });
        expect(r.code).toBe(5);
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('prints the operation data', async () => {
        const r = await runCli(
            ['wp', 'run', 'my-site', 'wp plugin list', '--yes'],
            {routes: {...sites, ...route}},
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toBe('akismet 5.3\n');
        expect(r.stdout).not.toContain('✔');
        const post = r.calls.find((c) => c.method === 'POST')!;
        expect(post.body).toEqual({wp_command: 'wp plugin list'});
    });
});

describe('wp run --json', () => {
    test('prints exactly one JSON document', async () => {
        const r = await runCli(
            ['wp', 'run', 'my-site', 'wp plugin list', '--yes', '--json'],
            {
                routes: {
                    ...sites,
                    'POST /sites/environments/env-live/run-wp-cli-command': {
                        body: {operation_id: 'op1', message: 'x', status: 202},
                    },
                    'GET /operations/op1': {
                        status: 200,
                        body: {message: 'ok', status: 200, data: 'akismet'},
                    },
                },
            },
        );
        expect(JSON.parse(r.stdout)).toEqual({
            operation_id: 'op1',
            status: 'completed',
            message: 'ok',
            data: 'akismet',
        });
    });
});

describe('wp login', () => {
    const route = {
        'POST /sites/environments/env-live/wpa-login-url': {
            body: {login_link: 'https://x.kinsta.cloud/?autologin=tok'},
        },
    };

    test('prints the link', async () => {
        const r = await runCli(
            ['wp', 'login', 'my-site', '--email', 'a@example.com'],
            {routes: {...sites, ...route}},
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toBe('https://x.kinsta.cloud/?autologin=tok\n');
        expect(r.calls.find((c) => c.method === 'POST')!.body).toEqual({
            email: 'a@example.com',
        });
    });

    test('--dry-run sends nothing', async () => {
        const r = await runCli(
            ['wp', 'login', 'my-site', '--email', 'a@example.com', '--dry-run'],
            {routes: {...sites, ...route}},
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('needs --email', async () => {
        const r = await runCli(['wp', 'login', 'my-site', '--json'], {
            routes: {...sites, ...route},
        });
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.message).toBe('Missing --email');
    });
});

describe('wp user', () => {
    test('create sends first_name and last_name', async () => {
        const r = await runCli(
            [
                'wp',
                'user',
                'create',
                'my-site',
                'a@example.com',
                '--first-name',
                'Ann',
                '--last-name',
                'Lee',
            ],
            {
                routes: {
                    ...sites,
                    'POST /sites/environments/env-live/wpa-create-user': {
                        body: {create_wp_admin_user: true},
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain(
            'Created WordPress admin user a@example.com',
        );
        expect(r.calls.find((c) => c.method === 'POST')!.body).toEqual({
            email: 'a@example.com',
            first_name: 'Ann',
            last_name: 'Lee',
        });
    });

    test('exists prints no', async () => {
        const r = await runCli(
            ['wp', 'user', 'exists', 'my-site', 'a@example.com'],
            {
                routes: {
                    ...sites,
                    'GET /sites/environments/env-live/wpa-user-exists': {
                        body: {has_wp_admin_user: false},
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toBe('no\n');
    });

    test('exists --json', async () => {
        const r = await runCli(
            ['wp', 'user', 'exists', 'my-site', 'a@example.com', '--json'],
            {
                routes: {
                    ...sites,
                    'GET /sites/environments/env-live/wpa-user-exists': {
                        body: {has_wp_admin_user: true},
                    },
                },
            },
        );
        expect(JSON.parse(r.stdout)).toEqual({
            email: 'a@example.com',
            has_wp_admin_user: true,
        });
    });
});

describe('db login', () => {
    test('prints the url', async () => {
        const r = await runCli(['db', 'login', 'my-site'], {
            routes: {
                ...sites,
                'POST /sites/environments/env-live/pma-login-token': {
                    body: {url: 'https://pma.kinsta.cloud/?k=1', expires_at: 1},
                },
            },
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toBe('https://pma.kinsta.cloud/?k=1\n');
    });
});
