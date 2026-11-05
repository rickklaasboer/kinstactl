import {describe, expect, test} from 'bun:test';
import {localTimeZone} from '@/cli/commands/analytics/metrics';
import {runCli} from '../../helpers/runCli';

const SITES = {
    company: {
        sites: [
            {
                id: 'site-1',
                name: 'my-site',
                display_name: 'My Site',
                status: 'live',
                environments: [
                    {id: 'env-live', name: 'live', display_name: 'Live'},
                ],
            },
        ],
    },
};

const A = '/sites/environments/env-live/analytics';

const series = {
    analytics: {
        analytics_response: {
            key: 'visits',
            data: [
                {
                    name: 'Visits',
                    total: 42,
                    dataset: [
                        {key: '2026-11-01', value: '20'},
                        {key: '2026-11-02', value: '22'},
                    ],
                },
            ],
        },
    },
};

const ips = {
    analytics: {
        analytics_response: {
            key: 'top-client-ips',
            data: [{ip: '203.0.113.7', value: '991'}],
        },
    },
};

const flow = {
    analytics: {
        traffic_flow: {
            traffic_types: [
                {traffic_type: 'human', label: 'Humans', total: 10},
            ],
            results: [{result: 'allowed', label: 'Allowed', total: 9}],
            flows: {},
        },
    },
};

const routes = (path: string, body: unknown) => ({
    'GET /sites': {body: SITES},
    [`GET ${A}/${path}`]: {status: 202, body},
});

const analyticsCall = (calls: {url: URL}[]) =>
    calls.find((c) => c.url.pathname.includes('/analytics/'))!;

describe('analytics', () => {
    test('visits prints each series and polls no operation', async () => {
        const r = await runCli(
            ['analytics', 'visits', 'my-site', '--env', 'live'],
            {routes: routes('visits', series)},
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('Visits (total 42)');
        expect(r.stdout).toContain('2026-11-02');
        expect(r.stdout).toContain('22');
        expect(
            r.calls.every((c) => !c.url.pathname.startsWith('/v2/operations')),
        ).toBe(true);
        const q = analyticsCall(r.calls).url.searchParams;
        expect(q.get('company_id')).toBe('c1');
        expect(q.get('time_span')).toBe('7_days');
    });

    test('top-ips maps to top-client-ips and renders ip and requests', async () => {
        const r = await runCli(
            ['analytics', 'top-ips', 'my-site', '--env', 'live'],
            {routes: routes('top-client-ips', ips)},
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('IP');
        expect(r.stdout).toContain('REQUESTS');
        expect(r.stdout).toContain('203.0.113.7');
        expect(r.stdout).toContain('991');
    });

    test('--span 30d sends time_span 30_days', async () => {
        const r = await runCli(
            [
                'analytics',
                'visits',
                'my-site',
                '--env',
                'live',
                '--span',
                '30d',
            ],
            {routes: routes('visits', series)},
        );
        expect(r.code).toBe(0);
        expect(analyticsCall(r.calls).url.searchParams.get('time_span')).toBe(
            '30_days',
        );
    });

    test('--from and --to are passed on', async () => {
        const r = await runCli(
            [
                'analytics',
                'visits',
                'my-site',
                '--env',
                'live',
                '--from',
                '2026-10-01',
                '--to',
                '2026-10-31',
            ],
            {routes: routes('visits', series)},
        );
        const q = analyticsCall(r.calls).url.searchParams;
        expect(q.get('from')).toBe('2026-10-01');
        expect(q.get('to')).toBe('2026-10-31');
        expect(q.has('time_span')).toBe(false);
    });

    test.each(['--from', '--to'])(
        '--span together with %s is a usage error before any request',
        async (flag) => {
            const r = await runCli(
                [
                    'analytics',
                    'visits',
                    'my-site',
                    '--env',
                    'live',
                    '--span',
                    '30d',
                    flag,
                    '2026-10-01',
                ],
                {routes: routes('visits', series)},
            );
            expect(r.code).toBe(2);
            expect(r.stderr).toContain('--span');
            expect(r.calls).toHaveLength(0);
        },
    );

    test('--to alone sends no time_span', async () => {
        const r = await runCli(
            [
                'analytics',
                'visits',
                'my-site',
                '--env',
                'live',
                '--to',
                '2026-10-31',
            ],
            {routes: routes('visits', series)},
        );
        expect(r.code).toBe(0);
        const q = analyticsCall(r.calls).url.searchParams;
        expect(q.get('to')).toBe('2026-10-31');
        expect(q.has('time_span')).toBe(false);
    });

    test('diskspace sends time_zone and rejects 24h', async () => {
        const ok = await runCli(
            [
                'analytics',
                'diskspace',
                'my-site',
                '--env',
                'live',
                '--time-zone',
                '-05:00',
            ],
            {routes: routes('diskspace', series)},
        );
        expect(ok.code).toBe(0);
        expect(analyticsCall(ok.calls).url.searchParams.get('time_zone')).toBe(
            '-05:00',
        );

        const bad = await runCli(
            [
                'analytics',
                'diskspace',
                'my-site',
                '--env',
                'live',
                '--span',
                '24h',
            ],
            {routes: routes('diskspace', series)},
        );
        expect(bad.code).toBe(2);
        expect(bad.stderr).toContain('no 24h span');
        expect(bad.calls).toHaveLength(0);
    });

    test('diskspace defaults to the local time zone of the run clock', async () => {
        const now = Date.UTC(2026, 10, 5, 12);
        const r = await runCli(
            ['analytics', 'diskspace', 'my-site', '--env', 'live'],
            {routes: routes('diskspace', series), io: {now: () => now}},
        );
        expect(r.code).toBe(0);
        expect(analyticsCall(r.calls).url.searchParams.get('time_zone')).toBe(
            localTimeZone(new Date(now)),
        );
    });

    test('--time-zone on another metric is a usage error', async () => {
        const r = await runCli(
            [
                'analytics',
                'visits',
                'my-site',
                '--env',
                'live',
                '--time-zone',
                '02:00',
            ],
            {routes: routes('visits', series)},
        );
        expect(r.code).toBe(2);
    });

    test('localTimeZone formats offsets', () => {
        const at = (offsetMinutes: number) =>
            Object.assign(new Date(0), {
                getTimezoneOffset: () => -offsetMinutes,
            });
        expect(localTimeZone(at(0))).toBe('00:00');
        expect(localTimeZone(at(120))).toBe('02:00');
        expect(localTimeZone(at(-300))).toBe('-05:00');
        expect(localTimeZone(at(330))).toBe('05:00');
        expect(localTimeZone(at(-330))).toBe('-05:00');
    });

    test('bot-traffic-flow renders both tables', async () => {
        const r = await runCli(
            ['analytics', 'bot-traffic-flow', 'my-site', '--env', 'live'],
            {routes: routes('bot-protection/traffic-flow', flow)},
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('TRAFFIC TYPE');
        expect(r.stdout).toContain('Humans');
        expect(r.stdout).toContain('RESULT');
        expect(r.stdout).toContain('Allowed');
    });

    test('an unknown metric is a usage error', async () => {
        const r = await runCli(
            ['analytics', 'nonsense', 'my-site', '--env', 'live'],
            {routes: routes('visits', series)},
        );
        expect(r.code).toBe(2);
    });

    test('--json prints the raw body', async () => {
        const r = await runCli(
            ['analytics', 'visits', 'my-site', '--env', 'live', '--json'],
            {routes: routes('visits', series)},
        );
        expect(JSON.parse(r.stdout)).toEqual(series);
    });

    test('a response without data is an error', async () => {
        const r = await runCli(
            ['analytics', 'visits', 'my-site', '--env', 'live'],
            {routes: routes('visits', {})},
        );
        expect(r.code).toBe(1);
    });
});

describe('sites usage', () => {
    const usageRoutes = {
        'GET /sites': {body: SITES},
        'GET /sites/site-1/usage/visits/this-month': {
            body: {site: {id: 'site-1', this_month_usage: {visits: 1234}}},
        },
        'GET /sites/site-1/usage/bandwidth/this-month': {
            body: {site: {id: 'site-1', this_month_usage: {bandwidth: 5678}}},
        },
        'GET /sites/site-1/usage/cdn-bandwidth/this-month': {
            body: {
                site: {id: 'site-1', this_month_cdn_usage: {bandwidth: 91011}},
            },
        },
    };

    test('prints the three numbers', async () => {
        const r = await runCli(['sites', 'usage', 'my-site'], {
            routes: usageRoutes,
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toBe(
            'Visits         1234\nBandwidth      5678\nCDN bandwidth  91011\n',
        );
    });

    test('--json prints one document', async () => {
        const r = await runCli(['sites', 'usage', 'my-site', '--json'], {
            routes: usageRoutes,
        });
        expect(JSON.parse(r.stdout)).toEqual({
            site: 'my-site',
            visits: 1234,
            bandwidth: 5678,
            cdn_bandwidth: 91011,
        });
    });
});
