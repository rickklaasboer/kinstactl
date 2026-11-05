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
