import {describe, expect, test} from 'bun:test';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runCli} from '../../helpers/runCli';

const SITES = {
    company: {
        sites: [
            {
                id: 'site-1',
                name: 'klant-x',
                display_name: 'Klant X',
                status: 'live',
                environments: [
                    {id: 'env-live', name: 'live', display_name: 'Live'},
                ],
            },
        ],
    },
};

const DOMAINS = {
    environment: {
        site_domains: [
            {id: 'd1', name: 'example.com', uses_cloudflare_dns: true},
            {id: 'd2', name: 'example.nl', uses_cloudflare_dns: false},
        ],
    },
};

const base = {
    'GET /sites': {body: SITES},
    'GET /sites/environments/env-live/domains': {body: DOMAINS},
};

const op = (method: string, path: string) => ({
    [`${method} ${path}`]: {status: 202, body: {operation_id: 'op1'}},
    'GET /operations/op1': {status: 200},
});

const writes = <T extends {method: string}>(calls: T[]) =>
    calls.filter((c) => c.method !== 'GET');

const SECRET =
    '-----BEGIN PRIVATE KEY-----\nSECRETKEYDATA\n-----END PRIVATE KEY-----\n';

function pemFiles(): {key: string; cert: string} {
    const dir = mkdtempSync(join(tmpdir(), 'kinstactl-pem-'));
    const key = join(dir, 'key.pem');
    const cert = join(dir, 'cert.pem');
    writeFileSync(key, SECRET);
    writeFileSync(cert, 'CERTDATA\n');
    return {key, cert};
}

describe('domains list', () => {
    test('prints name, id and cloudflare dns', async () => {
        const r = await runCli(['domains', 'list', 'klant-x'], {routes: base});
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('NAME');
        expect(r.stdout).toContain('CLOUDFLARE DNS');
        expect(r.stdout).toMatch(/example\.com\s+d1\s+yes/);
        expect(r.stdout).toMatch(/example\.nl\s+d2\s*\n/);
    });
});

describe('domains add', () => {
    const addRoute = op('POST', '/sites/environments/env-live/domains');

    test('sends only the given fields', async () => {
        const r = await runCli(
            ['domains', 'add', 'klant-x', 'new.com', '--json'],
            {routes: {...base, ...addRoute}},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.body).toEqual({domain_name: 'new.com'});
    });

    test('--wildcard and --with-www map to the body', async () => {
        const r = await runCli(
            [
                'domains',
                'add',
                'klant-x',
                'new.com',
                '--wildcard',
                '--with-www',
                '--setup-type',
                'avoid_downtime',
                '--json',
            ],
            {routes: {...base, ...addRoute}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]!.body).toEqual({
            domain_name: 'new.com',
            is_wildcardless: false,
            add_with_www_subdomain: true,
            setup_type: 'avoid_downtime',
        });
    });

    test('an unknown --setup-type is a usage error', async () => {
        const r = await runCli(
            ['domains', 'add', 'klant-x', 'new.com', '--setup-type', 'fast'],
            {routes: {...base, ...addRoute}},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('--dry-run redacts custom_ssl_key and the real request carries it', async () => {
        const {key, cert} = pemFiles();
        const args = [
            'domains',
            'add',
            'klant-x',
            'new.com',
            '--ssl-key',
            key,
            '--ssl-cert',
            cert,
            '--json',
        ];
        const dry = await runCli([...args, '--dry-run'], {
            routes: {...base, ...addRoute},
        });
        expect(dry.code).toBe(0);
        expect(writes(dry.calls)).toHaveLength(0);
        expect(dry.stdout).not.toContain('SECRETKEYDATA');
        expect(JSON.parse(dry.stdout).request.body).toEqual({
            domain_name: 'new.com',
            custom_ssl_key: '***',
            custom_ssl_cert: 'CERTDATA\n',
        });

        const real = await runCli(args, {routes: {...base, ...addRoute}});
        expect(real.code).toBe(0);
        expect(writes(real.calls)[0]!.body).toEqual({
            domain_name: 'new.com',
            custom_ssl_key: SECRET,
            custom_ssl_cert: 'CERTDATA\n',
        });
        expect(real.stdout + real.stderr).not.toContain('SECRETKEYDATA');
    });

    test('--ssl-key without --ssl-cert is a usage error', async () => {
        const {key} = pemFiles();
        const r = await runCli(
            ['domains', 'add', 'klant-x', 'new.com', '--ssl-key', key],
            {routes: {...base, ...addRoute}},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('a missing --ssl-key file is a usage error that never echoes content', async () => {
        const {cert} = pemFiles();
        const r = await runCli(
            [
                'domains',
                'add',
                'klant-x',
                'new.com',
                '--ssl-key',
                '/nonexistent/key.pem',
                '--ssl-cert',
                cert,
            ],
            {routes: {...base, ...addRoute}},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });
});

describe('domains remove', () => {
    const delRoute = op('DELETE', '/sites/environments/env-live/domains');

    test('resolves the name to an id and needs --yes', async () => {
        const refused = await runCli(
            ['domains', 'remove', 'klant-x', 'example.com'],
            {routes: {...base, ...delRoute}},
        );
        expect(refused.code).toBe(5);
        expect(writes(refused.calls)).toHaveLength(0);

        const r = await runCli(
            ['domains', 'remove', 'klant-x', 'example.com', '--yes', '--json'],
            {routes: {...base, ...delRoute}},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.method).toBe('DELETE');
        expect(sent[0]!.body).toEqual({domain_ids: ['d1']});
    });

    test('an ambiguous prefix lists the candidates and sends nothing', async () => {
        const r = await runCli(
            ['domains', 'remove', 'klant-x', 'exampl', '--yes', '--json'],
            {routes: {...base, ...delRoute}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.hints).toEqual([
            'example.com',
            'example.nl',
        ]);
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('an unknown domain is a usage error', async () => {
        const r = await runCli(
            ['domains', 'remove', 'klant-x', 'other.org', '--yes'],
            {routes: {...base, ...delRoute}},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });
});

describe('domains primary', () => {
    const putRoute = op(
        'PUT',
        '/sites/environments/env-live/change-primary-domain',
    );

    test('without --search-replace asks no confirmation', async () => {
        const r = await runCli(
            ['domains', 'primary', 'klant-x', 'example.nl', '--json'],
            {routes: {...base, ...putRoute}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]!.body).toEqual({
            domain_id: 'd2',
            run_search_and_replace: false,
        });
    });

    test('--search-replace without --yes exits 5 and sends nothing', async () => {
        const r = await runCli(
            ['domains', 'primary', 'klant-x', 'example.nl', '--search-replace'],
            {routes: {...base, ...putRoute}},
        );
        expect(r.code).toBe(5);
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('--search-replace --yes sends run_search_and_replace true', async () => {
        const r = await runCli(
            [
                'domains',
                'primary',
                'klant-x',
                'example.nl',
                '--search-replace',
                '--yes',
                '--json',
            ],
            {routes: {...base, ...putRoute}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]!.body).toEqual({
            domain_id: 'd2',
            run_search_and_replace: true,
        });
    });

    test('--dry-run with --search-replace sends nothing', async () => {
        const r = await runCli(
            [
                'domains',
                'primary',
                'klant-x',
                'example.nl',
                '--search-replace',
                '--yes',
                '--dry-run',
            ],
            {routes: {...base, ...putRoute}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)).toHaveLength(0);
    });
});

describe('domains verification', () => {
    const RECORDS = {
        site_domain: {
            verification_records: [
                {type: 'CNAME', name: '_acme.example.com', value: 'v.kinsta'},
            ],
            pointing_records: [
                {type: 'A', name: 'example.com', value: '192.0.2.10'},
            ],
        },
    };
    const routes = {
        ...base,
        'GET /sites/environments/domains/d1/verification-records': {
            body: RECORDS,
        },
    };

    test('prints both record sets', async () => {
        const r = await runCli(
            ['domains', 'verification', 'klant-x', 'example.com'],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('Verification records');
        expect(r.stdout).toContain('Pointing records');
        expect(r.stdout).toMatch(/CNAME\s+_acme\.example\.com\s+v\.kinsta/);
        expect(r.stdout).toMatch(/A\s+example\.com\s+192\.0\.2\.10/);
    });

    test('--json prints the raw response', async () => {
        const r = await runCli(
            ['domains', 'verification', 'klant-x', 'example.com', '--json'],
            {routes},
        );
        expect(JSON.parse(r.stdout)).toEqual(RECORDS);
    });
});
