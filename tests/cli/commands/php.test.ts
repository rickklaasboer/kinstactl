import {describe, expect, test} from 'bun:test';
import {runCli} from '../../helpers/runCli';

const routes = {
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
    'GET /sites/id-x/environments': {
        body: {
            site: {
                environments: [
                    {
                        id: 'env-live',
                        container_info: {php_engine_version: 'php8.2'},
                    },
                    {
                        id: 'env-stg',
                        container_info: {php_engine_version: 'php8.3'},
                    },
                ],
            },
        },
    },
};

describe('php version', () => {
    test('without a version prints the current one and writes nothing', async () => {
        const r = await runCli(['php', 'version', 'my-site', '--env', 'live'], {
            routes,
        });
        expect(r.code).toBe(0);
        expect(r.stdout.trim()).toBe('8.2');
        expect(r.calls.every((c) => c.method === 'GET')).toBe(true);
    });

    test('--no-auto-update without a version is a usage error and writes nothing', async () => {
        const r = await runCli(
            [
                'php',
                'version',
                'my-site',
                '--env',
                'live',
                '--no-auto-update',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(2);
        const {error} = JSON.parse(r.stderr);
        expect(error.code).toBe('USAGE');
        expect(error.message).toBe('--no-auto-update needs a version');
        expect(r.calls.filter((c) => c.method !== 'GET')).toEqual([]);
    });

    test('without a version in json', async () => {
        const r = await runCli(
            ['php', 'version', 'my-site', '--env', 'staging', '--json'],
            {routes},
        );
        expect(JSON.parse(r.stdout)).toEqual({
            site: 'my-site',
            environment: 'staging',
            php_version: '8.3',
        });
    });

    test('dry-run shows the request body', async () => {
        const r = await runCli(
            [
                'php',
                'version',
                'my-site',
                '8.3',
                '--env',
                'staging',
                '--dry-run',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout).request.body).toEqual({
            environment_id: 'env-stg',
            php_version: '8.3',
        });
        expect(r.calls.some((c) => c.method === 'PUT')).toBe(false);
    });

    test('--no-auto-update opts out of automatic updates', async () => {
        const r = await runCli(
            [
                'php',
                'version',
                'my-site',
                '8.3',
                '--env',
                'staging',
                '--no-auto-update',
                '--dry-run',
                '--json',
            ],
            {routes},
        );
        expect(JSON.parse(r.stdout).request.body).toEqual({
            environment_id: 'env-stg',
            php_version: '8.3',
            is_opt_out_from_automatic_php_update: true,
        });
    });

    test('changing the version sends PUT and waits', async () => {
        const r = await runCli(
            ['php', 'version', 'my-site', '8.3', '--env', 'live', '--json'],
            {
                routes: {
                    ...routes,
                    'PUT /sites/tools/modify-php-version': {
                        body: {operation_id: 'op1', message: 'ok'},
                    },
                    'GET /operations/op1': {status: 200},
                },
            },
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout).status).toBe('completed');
    });
});

describe('php restart', () => {
    test('sends the environment id', async () => {
        const r = await runCli(
            ['php', 'restart', 'my-site', '--env', 'live', '--json'],
            {
                routes: {
                    ...routes,
                    'POST /sites/tools/restart-php': {
                        body: {operation_id: 'op1', message: 'ok'},
                    },
                    'GET /operations/op1': {status: 200},
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.calls.find((c) => c.method === 'POST')!.body).toEqual({
            environment_id: 'env-live',
        });
    });

    test('every php command has an example', async () => {
        for (const sub of ['restart', 'version']) {
            const r = await runCli(['php', sub, '--help']);
            expect(r.stdout).toContain('Examples:');
        }
    });
});
