import {describe, expect, test} from 'bun:test';
import {runCli} from '../../helpers/runCli';

const ZONES = {
    company: {
        domains: [
            {id: 'z1', name: 'example.com', site_id: 's1', is_active: true},
            {id: 'z2', name: 'example.nl', site_id: null, is_active: false},
        ],
    },
};

const RECORDS = {
    domain: {
        dns_records: [
            {
                type: 'A',
                name: 'www.example.com',
                ttl: 300,
                resource_records: [{value: '1.2.3.4'}, {value: '5.6.7.8'}],
            },
        ],
    },
};

const base = {
    'GET /domains': {body: ZONES},
    'GET /domains/z1/dns-records': {body: RECORDS},
};

const opRoutes = (method: string) => ({
    [`${method} /domains/z1/dns-records`]: {
        status: 202,
        body: {operation_id: 'op1', message: 'ok', status: 202},
    },
    'GET /operations/op1': {status: 200},
});

const writes = <T extends {method: string}>(calls: T[]) =>
    calls.filter((c) => c.method !== 'GET');

describe('dns zones', () => {
    test('lists', async () => {
        const r = await runCli(['dns', 'zones'], {routes: base});
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('NAME');
        expect(r.stdout).toContain('example.com');
        expect(r.stdout).toContain('z2');
    });
});

describe('dns records list', () => {
    test('resolves the zone by name', async () => {
        const r = await runCli(['dns', 'records', 'list', 'example.com'], {
            routes: base,
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('www.example.com');
        expect(r.stdout).toContain('1.2.3.4, 5.6.7.8');
    });

    test('an ambiguous zone prefix lists candidates', async () => {
        const r = await runCli(
            ['dns', 'records', 'list', 'example', '--json'],
            {routes: base},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.hints).toEqual([
            'example.com',
            'example.nl',
        ]);
    });

    test('an unknown zone is a usage error and sends no records request', async () => {
        const r = await runCli(['dns', 'records', 'list', 'nope', '--json'], {
            routes: base,
        });
        expect(r.code).toBe(2);
        expect(
            r.calls.some((c) => c.url.pathname.includes('dns-records')),
        ).toBe(false);
    });
});

describe('dns records add', () => {
    test('sends resource_records and waits', async () => {
        const r = await runCli(
            [
                'dns',
                'records',
                'add',
                'example.com',
                'A',
                'www',
                '--value',
                '1.2.3.4',
                '5.6.7.8',
                '--json',
            ],
            {routes: {...base, ...opRoutes('POST')}},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.body).toEqual({
            type: 'A',
            name: 'www',
            ttl: 300,
            resource_records: [{value: '1.2.3.4'}, {value: '5.6.7.8'}],
        });
        expect(
            r.calls.some((c) => c.url.pathname.endsWith('/operations/op1')),
        ).toBe(true);
    });

    test('without --value is a usage error', async () => {
        const r = await runCli(
            ['dns', 'records', 'add', 'example.com', 'A', 'www', '--json'],
            {routes: {...base, ...opRoutes('POST')}},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('a ttl below 300 is a usage error', async () => {
        const r = await runCli(
            [
                'dns',
                'records',
                'add',
                'example.com',
                'A',
                'www',
                '--value',
                '1.2.3.4',
                '--ttl',
                '60',
                '--json',
            ],
            {routes: {...base, ...opRoutes('POST')}},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });
});

describe('dns records update', () => {
    test('sends only the given changes', async () => {
        const r = await runCli(
            [
                'dns',
                'records',
                'update',
                'example.com',
                'A',
                'www',
                '--add',
                '9.9.9.9',
                '--json',
            ],
            {routes: {...base, ...opRoutes('PUT')}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]!.body).toEqual({
            type: 'A',
            name: 'www',
            new_resource_records: [{value: '9.9.9.9'}],
        });
    });

    test('without changes is a usage error', async () => {
        const r = await runCli(
            ['dns', 'records', 'update', 'example.com', 'A', 'www', '--json'],
            {routes: {...base, ...opRoutes('PUT')}},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });
});

describe('dns records delete', () => {
    const argv = ['dns', 'records', 'delete', 'example.com', 'A', 'www'];

    test('needs --yes and names the zone', async () => {
        const r = await runCli([...argv, '--json'], {
            routes: {...base, ...opRoutes('DELETE')},
        });
        expect(r.code).toBe(5);
        expect(JSON.parse(r.stderr).error.message).toBe(
            'Delete A record www on zone example.com needs confirmation',
        );
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('--yes sends type and name', async () => {
        const r = await runCli([...argv, '--yes', '--json'], {
            routes: {...base, ...opRoutes('DELETE')},
        });
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.body).toEqual({type: 'A', name: 'www'});
    });

    test('interactive confirm prompt names the zone', async () => {
        let asked = '';
        const r = await runCli(argv, {
            routes: {...base, ...opRoutes('DELETE')},
            tty: true,
            prompts: {
                confirm: async (m: string) => {
                    asked = m;
                    return true;
                },
            },
        });
        expect(r.code).toBe(0);
        expect(asked).toBe('Delete A record www on zone example.com?');
        expect(writes(r.calls)).toHaveLength(1);
    });

    test('--dry-run sends nothing', async () => {
        const r = await runCli([...argv, '--dry-run', '--json'], {
            routes: {...base, ...opRoutes('DELETE')},
        });
        expect(r.code).toBe(0);
        expect(writes(r.calls)).toHaveLength(0);
    });
});
