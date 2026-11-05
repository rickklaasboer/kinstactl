import {describe, expect, test} from 'bun:test';
import type {FakeCall} from '../../helpers/fakeKinsta';
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

const writes = (calls: FakeCall[]) => calls.filter((c) => c.method !== 'GET');

const DENIED = '/sites/tools/denied-ips';
const denied = (ips: string[]) => ({
    [`GET ${DENIED}`]: {
        body: {environment: {id: 'env-live', ip_list: ips}},
    },
    [`PUT ${DENIED}`]: {body: {result: null}},
});

describe('security denied-ips', () => {
    test('denied-ips prints the list', async () => {
        const r = await runCli(['security', 'denied-ips', 'my-site'], {
            routes: {...sites, ...denied(['1.1.1.1', '2.2.2.2'])},
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toBe('1.1.1.1\n2.2.2.2\n');
        expect(r.calls.at(-1)?.url.searchParams.get('environment_id')).toBe(
            'env-live',
        );
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('denied-ips --add sends the merged list and needs --yes', async () => {
        const routes = {...sites, ...denied(['1.1.1.1'])};
        const refused = await runCli(
            ['security', 'denied-ips', 'my-site', '--add', '2.2.2.2'],
            {routes},
        );
        expect(refused.code).toBe(5);
        expect(writes(refused.calls)).toHaveLength(0);

        const r = await runCli(
            ['security', 'denied-ips', 'my-site', '--add', '2.2.2.2', '--yes'],
            {routes},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.body).toEqual({
            environment_id: 'env-live',
            ip_list: ['1.1.1.1', '2.2.2.2'],
        });
        expect(r.stdout).toContain('Denied IPs updated');
    });

    test('denied-ips --remove drops the entry', async () => {
        const r = await runCli(
            [
                'security',
                'denied-ips',
                'my-site',
                '--remove',
                '1.1.1.1',
                '--yes',
            ],
            {routes: {...sites, ...denied(['1.1.1.1', '2.2.2.2'])}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]?.body).toEqual({
            environment_id: 'env-live',
            ip_list: ['2.2.2.2'],
        });
    });

    test('denied-ips --add of a present ip is a usage error', async () => {
        const r = await runCli(
            [
                'security',
                'denied-ips',
                'my-site',
                '--add',
                '1.1.1.1',
                '--yes',
                '--json',
            ],
            {routes: {...sites, ...denied(['1.1.1.1'])}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('denied-ips --remove of a missing ip is a usage error', async () => {
        const r = await runCli(
            [
                'security',
                'denied-ips',
                'my-site',
                '--remove',
                '9.9.9.9',
                '--yes',
                '--json',
            ],
            {routes: {...sites, ...denied(['1.1.1.1'])}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('denied-ips --add of an ip repeated in --add is a usage error', async () => {
        const r = await runCli(
            [
                'security',
                'denied-ips',
                'my-site',
                '--add',
                '2.2.2.2',
                '2.2.2.2',
                '--yes',
                '--json',
            ],
            {routes: {...sites, ...denied(['1.1.1.1'])}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('denied-ips with an ip in --add and --remove is a usage error', async () => {
        const r = await runCli(
            [
                'security',
                'denied-ips',
                'my-site',
                '--add',
                '2.2.2.2',
                '--remove',
                '2.2.2.2',
                '--yes',
                '--json',
            ],
            {routes: {...sites, ...denied(['1.1.1.1'])}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('denied-ips --clear with --add is a usage error', async () => {
        const r = await runCli(
            [
                'security',
                'denied-ips',
                'my-site',
                '--clear',
                '--add',
                '2.2.2.2',
                '--yes',
                '--json',
            ],
            {routes: {...sites, ...denied(['1.1.1.1'])}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('denied-ips --clear --yes sends an empty list', async () => {
        const r = await runCli(
            ['security', 'denied-ips', 'my-site', '--clear', '--yes', '--json'],
            {routes: {...sites, ...denied(['1.1.1.1'])}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]?.body).toEqual({
            environment_id: 'env-live',
            ip_list: [],
        });
        expect(JSON.parse(r.stdout)).toEqual({ip_list: []});
    });
});

const RR = '/sites/environments/env-live/redirect-rules';
const stored = (from: string, domain: string | null = null) => ({
    from,
    to: '/new',
    type: 'permanent',
    domain,
    traffic_from_country: null,
    traffic_from_country_name: null,
    traffic_from_city: null,
    displayed_location: null,
});
const rules = (list: ReturnType<typeof stored>[]) => ({
    [`GET ${RR}`]: {
        body: {
            environment: {
                id: 'env-live',
                container_info: {
                    redirect_rules: {
                        rules: list,
                        redirect_rules_count: list.length,
                    },
                },
            },
        },
    },
    [`POST ${RR}`]: {body: {result: null}},
});

describe('security redirects', () => {
    test('redirects list passes the query', async () => {
        const r = await runCli(
            [
                'security',
                'redirects',
                'list',
                'my-site',
                '--limit',
                '5',
                '--offset',
                '2',
                '--search',
                'old',
                '--regex',
                '--sort',
                'from',
                '--desc',
            ],
            {routes: {...sites, ...rules([stored('/old')])}},
        );
        expect(r.code).toBe(0);
        const q = r.calls.at(-1)?.url.searchParams;
        expect(Object.fromEntries(q ?? [])).toEqual({
            limit: '5',
            offset: '2',
            search_query: 'old',
            regex_search: 'true',
            key: 'from',
            order: 'descend',
        });
        expect(r.stdout).toContain('/old');
        expect(r.stderr).toContain('1 of 1 rules');
    });

    test('redirects add sends NEW with a null domain by default', async () => {
        const r = await runCli(
            ['security', 'redirects', 'add', 'my-site', '/a', '/b'],
            {routes: {...sites, ...rules([])}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]?.body).toEqual({
            action_type: 'NEW',
            new_value: {domain: null, from: '/a', to: '/b', type: 'permanent'},
        });
    });

    test('redirects add prints one json document', async () => {
        const r = await runCli(
            [
                'security',
                'redirects',
                'add',
                'my-site',
                '/a',
                '/b',
                '--type',
                'redirect',
                '--domain',
                'example.com',
                '--json',
            ],
            {routes: {...sites, ...rules([])}},
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual({
            from: '/a',
            to: '/b',
            type: 'redirect',
            domain: 'example.com',
        });
    });

    test('redirects update finds the rule and sends UPDATE', async () => {
        const existing = stored('/old');
        const r = await runCli(
            [
                'security',
                'redirects',
                'update',
                'my-site',
                '/old',
                '--to',
                '/newer',
                '--yes',
            ],
            {routes: {...sites, ...rules([existing, stored('/other')])}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]?.body).toEqual({
            action_type: 'UPDATE',
            rules_to_update: [existing],
            new_value: {...existing, to: '/newer'},
        });
    });

    test('redirects update without a change is a usage error', async () => {
        const r = await runCli(
            ['security', 'redirects', 'update', 'my-site', '/old', '--yes'],
            {routes: {...sites, ...rules([stored('/old')])}},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('redirects update of a from on several domains asks for --domain', async () => {
        const r = await runCli(
            [
                'security',
                'redirects',
                'update',
                'my-site',
                '/old',
                '--to',
                '/n',
                '--yes',
                '--json',
            ],
            {
                routes: {
                    ...sites,
                    ...rules([stored('/old', 'a.nl'), stored('/old', 'b.nl')]),
                },
            },
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.message).toContain('--domain');
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('redirects delete needs --yes', async () => {
        const routes = {...sites, ...rules([stored('/old')])};
        const refused = await runCli(
            ['security', 'redirects', 'delete', 'my-site', '/old'],
            {routes},
        );
        expect(refused.code).toBe(5);
        expect(writes(refused.calls)).toHaveLength(0);

        const r = await runCli(
            ['security', 'redirects', 'delete', 'my-site', '/old', '--yes'],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]?.body).toEqual({
            action_type: 'DELETE',
            rules_to_update: [stored('/old')],
        });
    });

    test('redirects delete --all sends DELETE_ALL', async () => {
        const r = await runCli(
            [
                'security',
                'redirects',
                'delete',
                'my-site',
                '--all',
                '--yes',
                '--json',
            ],
            {routes: {...sites, ...rules([])}},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]?.body).toEqual({action_type: 'DELETE_ALL'});
        expect(JSON.parse(r.stdout)).toEqual({deleted: 'all'});
    });

    test('redirects delete needs from or --all, not both', async () => {
        const neither = await runCli(
            ['security', 'redirects', 'delete', 'my-site', '--yes'],
            {routes: {...sites, ...rules([])}},
        );
        expect(neither.code).toBe(2);
        const both = await runCli(
            [
                'security',
                'redirects',
                'delete',
                'my-site',
                '/a',
                '--all',
                '--yes',
            ],
            {routes: {...sites, ...rules([])}},
        );
        expect(both.code).toBe(2);
        expect(writes(both.calls)).toHaveLength(0);
    });

    test('redirects delete of an unknown from lists the existing ones', async () => {
        const r = await runCli(
            [
                'security',
                'redirects',
                'delete',
                'my-site',
                '/nope',
                '--yes',
                '--json',
            ],
            {routes: {...sites, ...rules([stored('/old'), stored('/other')])}},
        );
        expect(r.code).toBe(2);
        const error = JSON.parse(r.stderr).error;
        expect(error.code).toBe('USAGE');
        expect(error.hints).toEqual(['/old', '/other']);
        expect(writes(r.calls)).toHaveLength(0);
    });
});
