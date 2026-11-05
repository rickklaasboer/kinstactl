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
                name: 'my-site',
                display_name: 'My Site',
                status: 'live',
                environments: [
                    env('env-x-live', 'live', 'Live'),
                    env('env-x-staging', 'staging', 'Staging'),
                ],
            },
        ],
    },
};

const siteBody = {
    site: {
        id: 'id-x',
        name: 'my-site',
        display_name: 'My Site',
        company_id: 'c1',
        status: 'live',
        environments: [],
    },
};

describe('sites list', () => {
    test('--json prints the API sites array', async () => {
        const r = await runCli(['sites', 'list', '--json'], {
            routes: {'GET /sites': {body: sitesBody}},
        });
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual(sitesBody.company.sites);
    });

    test('human output shows a table with environments', async () => {
        const r = await runCli(['sites', 'list'], {
            routes: {'GET /sites': {body: sitesBody}},
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('ENVIRONMENTS');
        expect(r.stdout).toContain('my-site');
        expect(r.stdout).toContain('live, staging');
        expect(r.stdout).toContain('id-x');
    });

    test('--refresh bypasses the cache', async () => {
        const routes = {'GET /sites': {body: sitesBody}};
        const first = await runCli(['sites', 'list', '--refresh'], {routes});
        expect(first.calls).toHaveLength(1);
    });
});

describe('sites get', () => {
    test('--json prints the API site', async () => {
        const r = await runCli(['sites', 'get', 'my-site', '--json'], {
            routes: {
                'GET /sites': {body: sitesBody},
                'GET /sites/id-x': {body: siteBody},
            },
        });
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual(siteBody.site);
    });

    test('human output is a key/value block', async () => {
        const r = await runCli(['sites', 'get', 'my-site'], {
            routes: {
                'GET /sites': {body: sitesBody},
                'GET /sites/id-x': {body: siteBody},
            },
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('Name');
        expect(r.stdout).toContain('my-site');
        expect(r.stdout).toContain('My Site');
        expect(r.stdout).toContain('live');
    });

    test('unknown site exits 2 with SITE_NOT_FOUND', async () => {
        const r = await runCli(['sites', 'get', 'nope', '--json'], {
            routes: {'GET /sites': {body: sitesBody}},
        });
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('SITE_NOT_FOUND');
    });
});
