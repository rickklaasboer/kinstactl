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
                    {id: 'env-x-live', name: 'live', display_name: 'Live'},
                    {
                        id: 'env-x-staging',
                        name: 'staging',
                        display_name: 'Staging',
                    },
                ],
            },
        ],
    },
};

const envsBody = {
    site: {
        environments: [
            {
                id: 'env-x-live',
                name: 'live',
                display_name: 'Live',
                primaryDomain: {name: 'klant-x.nl'},
                container_info: {php_engine_version: '8.2'},
            },
            {
                id: 'env-x-staging',
                name: 'staging',
                display_name: 'Staging',
                primaryDomain: {name: 'staging-klant-x.kinsta.cloud'},
                container_info: {php_engine_version: '8.3'},
            },
        ],
    },
};

const routes = {
    'GET /sites': {body: sitesBody},
    'GET /sites/id-x/environments': {body: envsBody},
};

describe('env list', () => {
    test('human output shows environments with PHP and primary domain', async () => {
        const r = await runCli(['env', 'list', 'klant-x'], {routes});
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('PRIMARY DOMAIN');
        expect(r.stdout).toContain('live');
        expect(r.stdout).toContain('staging');
        expect(r.stdout).toContain('8.2');
        expect(r.stdout).toContain('klant-x.nl');
        expect(r.stdout).toContain('env-x-live');
    });

    test('--json prints the API environments array', async () => {
        const r = await runCli(['env', 'list', 'klant-x', '--json'], {routes});
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual(envsBody.site.environments);
    });

    test('unknown site exits 2', async () => {
        const r = await runCli(['env', 'list', 'nope', '--json'], {routes});
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('SITE_NOT_FOUND');
    });
});

describe('env push', () => {
    const pushRoutes = {
        'GET /sites': {body: sitesBody},
        'PUT /sites/id-x/environments': {body: {operation_id: 'op1'}},
        'GET /operations/op1': {status: 200},
    };
    const base = [
        'env',
        'push',
        'klant-x',
        '--from',
        'staging',
        '--to',
        'live',
    ];
    const puts = (calls: {method: string}[]) =>
        calls.filter((c) => c.method === 'PUT');

    test('--no-db pushes files only with ALL_FILES', async () => {
        const r = await runCli([...base, '--no-db', '--yes', '--json'], {
            routes: pushRoutes,
        });
        expect(r.code).toBe(0);
        const put = r.calls.find((c) => c.method === 'PUT')!;
        expect(put.body).toEqual({
            source_env_id: 'env-x-staging',
            target_env_id: 'env-x-live',
            push_db: false,
            push_files: true,
            run_search_and_replace: true,
            push_files_option: 'ALL_FILES',
        });
    });

    test('--path sets SPECIFIC_FILES and file_list', async () => {
        const r = await runCli(
            [
                ...base,
                '--path',
                'wp-content/themes',
                'wp-content/uploads',
                '--yes',
                '--json',
            ],
            {routes: pushRoutes},
        );
        expect(r.code).toBe(0);
        const put = r.calls.find((c) => c.method === 'PUT')!;
        expect(put.body).toMatchObject({
            push_files_option: 'SPECIFIC_FILES',
            file_list: ['wp-content/themes', 'wp-content/uploads'],
        });
    });

    test('--no-search-replace and --no-files are passed through', async () => {
        const r = await runCli(
            [...base, '--no-files', '--no-search-replace', '--yes', '--json'],
            {routes: pushRoutes},
        );
        expect(r.code).toBe(0);
        expect(puts(r.calls)[0]!).toMatchObject({
            body: {
                push_db: true,
                push_files: false,
                run_search_and_replace: false,
            },
        });
    });

    test('same environment twice exits 2 before any request to push', async () => {
        const r = await runCli(
            [
                'env',
                'push',
                'klant-x',
                '--from',
                'live',
                '--to',
                'live',
                '--yes',
                '--json',
            ],
            {routes: pushRoutes},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(puts(r.calls)).toEqual([]);
    });

    test('--no-db with --no-files exits 2 and sends no PUT', async () => {
        const r = await runCli(
            [...base, '--no-db', '--no-files', '--yes', '--json'],
            {routes: pushRoutes},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(puts(r.calls)).toEqual([]);
    });

    test('--no-files with --path exits 2 and sends no PUT', async () => {
        const r = await runCli(
            [...base, '--no-files', '--path', 'wp-content', '--yes', '--json'],
            {routes: pushRoutes},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(puts(r.calls)).toEqual([]);
    });

    test('missing --to non-interactive exits 2 with ENV_REQUIRED', async () => {
        const r = await runCli(
            ['env', 'push', 'klant-x', '--from', 'staging', '--yes', '--json'],
            {routes: pushRoutes},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('ENV_REQUIRED');
        expect(puts(r.calls)).toEqual([]);
    });

    test('non-interactive without --yes exits 5 and sends no PUT', async () => {
        const r = await runCli([...base, '--json'], {routes: pushRoutes});
        expect(r.code).toBe(5);
        expect(puts(r.calls)).toEqual([]);
    });

    test('--dry-run non-interactive without --yes exits 0 and sends no PUT', async () => {
        const r = await runCli([...base, '--dry-run', '--json'], {
            routes: pushRoutes,
        });
        expect(r.code).toBe(0);
        expect(puts(r.calls)).toEqual([]);
        expect(JSON.parse(r.stdout).dry_run).toBe(true);
    });
});
