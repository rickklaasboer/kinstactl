import {describe, expect, test} from 'bun:test';
import {done, SITES_ROUTES, started} from '../../helpers/fixtures';
import {runCli} from '../../helpers/runCli';

const writes = <T extends {method: string}>(calls: T[]) =>
    calls.filter((c) => c.method !== 'GET');

const routes = {
    ...SITES_ROUTES,
    'POST /sites/id-x/environments': started('op1'),
    'POST /sites/id-x/environments/plain': started('op1'),
    'POST /sites/id-x/environments/clone': started('op1'),
    'DELETE /sites/environments/env-stg': started('op1'),
    'POST /sites/environments/env-stg/change-environment-php-allocation':
        started('op1'),
    'POST /sites/environments/env-stg/change-webroot-subfolder': started('op1'),
    ...done('op1'),
};

const WP_FLAGS = [
    '--admin-user',
    'admin',
    '--admin-email',
    'a@b.nl',
    '--admin-password',
    '-',
];

describe('env create', () => {
    test('env create sends the wp fields and is_premium', async () => {
        const r = await runCli(
            ['env', 'create', 'klant-x', 'dev', ...WP_FLAGS, '--json'],
            {routes, io: {stdin: async () => 's3cret\n'}},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.url.pathname).toBe('/v2/sites/id-x/environments');
        expect(sent[0]!.body).toEqual({
            display_name: 'dev',
            is_premium: false,
            admin_user: 'admin',
            admin_email: 'a@b.nl',
            admin_password: 's3cret',
            site_title: 'dev',
            wp_language: 'en_US',
        });
    });

    test('env create --premium sets is_premium', async () => {
        const r = await runCli(
            [
                'env',
                'create',
                'klant-x',
                'dev',
                '--premium',
                ...WP_FLAGS,
                '--json',
            ],
            {routes, io: {stdin: async () => 's3cret\n'}},
        );
        expect(r.code).toBe(0);
        expect(
            (writes(r.calls)[0]!.body as {is_premium: boolean}).is_premium,
        ).toBe(true);
    });

    test('env create --dry-run redacts the password', async () => {
        const r = await runCli(
            [
                'env',
                'create',
                'klant-x',
                'dev',
                ...WP_FLAGS,
                '--dry-run',
                '--json',
            ],
            {routes, io: {stdin: async () => 's3cret\n'}},
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout).request.body.admin_password).toBe('***');
        expect(r.stdout).not.toContain('s3cret');
        expect(writes(r.calls)).toEqual([]);
    });

    test('env create --plain sends display_name and is_premium only', async () => {
        const r = await runCli(
            ['env', 'create', 'klant-x', 'dev', '--plain', '--json'],
            {routes},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent[0]!.url.pathname).toBe('/v2/sites/id-x/environments/plain');
        expect(sent[0]!.body).toEqual({display_name: 'dev', is_premium: false});
    });
});

describe('env clone', () => {
    test('env clone sends source_env_id of --from', async () => {
        const r = await runCli(
            ['env', 'clone', 'klant-x', 'dev', '--from', 'staging', '--json'],
            {routes},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent[0]!.url.pathname).toBe('/v2/sites/id-x/environments/clone');
        expect(sent[0]!.body).toEqual({
            display_name: 'dev',
            is_premium: false,
            source_env_id: 'env-stg',
        });
    });
});

describe('env delete', () => {
    test('env delete needs --confirm', async () => {
        const ok = await runCli(
            [
                'env',
                'delete',
                'klant-x',
                '--env',
                'staging',
                '--confirm',
                'klant-x',
                '--json',
            ],
            {routes},
        );
        expect(ok.code).toBe(0);
        const sent = writes(ok.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.method).toBe('DELETE');
        expect(sent[0]!.url.pathname).toBe('/v2/sites/environments/env-stg');

        const refused = await runCli(
            ['env', 'delete', 'klant-x', '--env', 'staging', '--json'],
            {routes},
        );
        expect(refused.code).toBe(5);
        expect(writes(refused.calls)).toEqual([]);
    });

    test('env delete rejects --yes', async () => {
        const r = await runCli(
            ['env', 'delete', 'klant-x', '--env', 'staging', '--yes'],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toEqual([]);
    });
});

describe('env php-allocation', () => {
    test('env php-allocation sends thread_count and thread_memory', async () => {
        const r = await runCli(
            [
                'env',
                'php-allocation',
                'klant-x',
                '--env',
                'staging',
                '--threads',
                '4',
                '--memory',
                '256',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent[0]!.url.pathname).toBe(
            '/v2/sites/environments/env-stg/change-environment-php-allocation',
        );
        expect(sent[0]!.body).toEqual({thread_count: 4, thread_memory: 256});
    });
});

describe('env webroot', () => {
    test('env webroot rejects a subfolder outside the pattern before any request', async () => {
        for (const bad of ['public', '/pub lic']) {
            const r = await runCli(
                ['env', 'webroot', 'klant-x', bad, '--env', 'staging'],
                {routes},
            );
            expect(r.code).toBe(2);
            expect(r.calls).toEqual([]);
        }
    });

    test('env webroot sends only negated flags', async () => {
        const r = await runCli(
            [
                'env',
                'webroot',
                'klant-x',
                '/public',
                '--env',
                'staging',
                '--no-clear-cache',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent[0]!.url.pathname).toBe(
            '/v2/sites/environments/env-stg/change-webroot-subfolder',
        );
        expect(sent[0]!.body).toEqual({
            web_root_subfolder: '/public',
            clear_all_cache: false,
        });
    });

    test('env webroot without flags sends the subfolder only', async () => {
        const r = await runCli(
            ['env', 'webroot', 'klant-x', '/', '--env', 'staging', '--json'],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]!.body).toEqual({web_root_subfolder: '/'});
    });
});

describe('env files', () => {
    const filesRoutes = {
        ...SITES_ROUTES,
        'GET /sites/environments/env-stg/file-list': {
            body: {
                environment: {
                    id: 'env-stg',
                    file_list: [
                        {
                            name: 'wp-content',
                            path: 'wp-content',
                            children: [
                                {
                                    name: 'themes',
                                    path: 'wp-content/themes',
                                    children: [],
                                },
                            ],
                        },
                    ],
                },
            },
        },
    };

    test('env files prints the tree', async () => {
        const r = await runCli(
            ['env', 'files', 'klant-x', '--env', 'staging'],
            {routes: filesRoutes},
        );
        expect(r.code).toBe(0);
        expect(r.stdout.split('\n')).toEqual(
            expect.arrayContaining(['wp-content', '  themes']),
        );
    });

    test('env files --json returns the paths as received', async () => {
        const r = await runCli(
            ['env', 'files', 'klant-x', '--env', 'staging', '--json'],
            {routes: filesRoutes},
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)[0].path).toBe('wp-content');
    });
});
