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
                        ],
                    },
                ],
            },
        },
    },
};

const envs = (type: string | null) => ({
    'GET /sites/id-x/environments': {
        body: {
            site: {
                environments: [{id: 'env-live', image_optimization_type: type}],
            },
        },
    },
});

const started = (id: string) => ({
    body: {operation_id: id, message: 'started'},
});

describe('cache edge enable/disable', () => {
    test('cache edge enable sends enabled true', async () => {
        const r = await runCli(
            ['cache', 'edge', 'enable', 'klant-x', '--env', 'live', '--json'],
            {
                routes: {
                    ...sites,
                    'PUT /sites/edge-caching/status': started('op1'),
                    'GET /operations/op1': {status: 200},
                },
            },
        );
        expect(r.code).toBe(0);
        const put = r.calls.find((c) => c.method === 'PUT')!;
        expect(put.url.pathname).toBe('/v2/sites/edge-caching/status');
        expect(put.body).toEqual({environment_id: 'env-live', enabled: true});
    });

    test('cache edge disable sends enabled false', async () => {
        const r = await runCli(
            ['cache', 'edge', 'disable', 'klant-x', '--env', 'live', '--json'],
            {
                routes: {
                    ...sites,
                    'PUT /sites/edge-caching/status': started('op2'),
                    'GET /operations/op2': {status: 200},
                },
            },
        );
        expect(r.code).toBe(0);
        const put = r.calls.find((c) => c.method === 'PUT')!;
        expect(put.body).toEqual({environment_id: 'env-live', enabled: false});
    });
});

describe('cache cdn image-optimization', () => {
    const base = ['cache', 'cdn', 'image-optimization', 'klant-x', '--env'];

    test('without a type shows the current setting', async () => {
        const r = await runCli([...base, 'live'], {
            routes: {...sites, ...envs('lossy')},
        });
        expect(r.code).toBe(0);
        expect(r.stdout.trim()).toBe('lossy');
        expect(r.calls.some((c) => c.method === 'PUT')).toBe(false);
    });

    test('without a type shows (none) for null and JSON for --json', async () => {
        const human = await runCli([...base, 'live'], {
            routes: {...sites, ...envs(null)},
        });
        expect(human.stdout.trim()).toBe('(none)');
        const json = await runCli([...base, 'live', '--json'], {
            routes: {...sites, ...envs('off')},
        });
        expect(JSON.parse(json.stdout)).toEqual({
            site: 'klant-x',
            environment: 'live',
            image_optimization_type: 'off',
        });
    });

    test('image-optimization lossless sends the body', async () => {
        const r = await runCli([...base, 'live', '--json'].concat('lossless'), {
            routes: {
                ...sites,
                'PUT /sites/cdn/image-optimization': started('op3'),
                'GET /operations/op3': {status: 200},
            },
        });
        expect(r.code).toBe(0);
        const put = r.calls.find((c) => c.method === 'PUT')!;
        expect(put.body).toEqual({
            environment_id: 'env-live',
            image_optimization_type: 'lossless',
        });
    });

    test('an unknown type is a usage error', async () => {
        const r = await runCli([...base, 'live', '--json'].concat('extreme'), {
            routes: sites,
        });
        expect(r.code).toBe(2);
        expect(r.calls.some((c) => c.method === 'PUT')).toBe(false);
    });
});
