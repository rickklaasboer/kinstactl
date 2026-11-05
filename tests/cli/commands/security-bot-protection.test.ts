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

const BP = '/sites/environments/env-live/bot-protection';
const started = {status: 202, body: {operation_id: 'op1'}};
const done = {'GET /operations/op1': {status: 200}};

describe('security force-https', () => {
    test('shows primary for ENABLED_REDIRECT_TO_PRIMARY', async () => {
        const r = await runCli(
            ['security', 'force-https', 'klant-x', '--env', 'live'],
            {
                routes: {
                    ...sites,
                    'GET /sites/environments/env-live/force-https-status': {
                        body: {
                            force_https_status: 'ENABLED_REDIRECT_TO_PRIMARY',
                        },
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.stdout.trim()).toBe('primary');
    });

    test('off sends DISABLED', async () => {
        const r = await runCli(
            ['security', 'force-https', 'klant-x', 'off', '--env', 'live'],
            {
                routes: {
                    ...sites,
                    'POST /sites/environments/env-live/force-https-status':
                        started,
                    ...done,
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.calls.find((c) => c.method === 'POST')?.body).toEqual({
            type: 'DISABLED',
        });
    });
});

describe('security bot-protection', () => {
    test('level shows the current level', async () => {
        const r = await runCli(
            ['security', 'bot-protection', 'level', 'klant-x', '--env', 'live'],
            {
                routes: {
                    ...sites,
                    [`GET ${BP}/level`]: {
                        body: {
                            bot_protection: {id: 'x', level: 'challenge-bots'},
                        },
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.stdout.trim()).toBe('challenge-bots');
    });

    test('level shows not configured for null', async () => {
        const r = await runCli(
            ['security', 'bot-protection', 'level', 'klant-x', '--env', 'live'],
            {
                routes: {
                    ...sites,
                    [`GET ${BP}/level`]: {body: {bot_protection: null}},
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.stdout.trim()).toBe('(not configured)');
    });

    test('level sets and waits', async () => {
        const r = await runCli(
            [
                'security',
                'bot-protection',
                'level',
                'klant-x',
                'block-automations',
                '--env',
                'live',
            ],
            {routes: {...sites, [`PUT ${BP}/level`]: started, ...done}},
        );
        expect(r.code).toBe(0);
        expect(r.calls.find((c) => c.method === 'PUT')?.body).toEqual({
            level: 'block-automations',
        });
        expect(
            r.calls.some((c) => c.url.pathname.endsWith('/operations/op1')),
        ).toBe(true);
    });

    test('ai-crawlers block sends enabled', async () => {
        const r = await runCli(
            [
                'security',
                'bot-protection',
                'ai-crawlers',
                'klant-x',
                'block',
                '--env',
                'live',
            ],
            {routes: {...sites, [`PUT ${BP}/ai-crawlers`]: started, ...done}},
        );
        expect(r.code).toBe(0);
        expect(r.calls.find((c) => c.method === 'PUT')?.body).toEqual({
            status: 'enabled',
        });
    });

    test('ai-crawlers shows block when enabled', async () => {
        const r = await runCli(
            [
                'security',
                'bot-protection',
                'ai-crawlers',
                'klant-x',
                '--env',
                'live',
            ],
            {
                routes: {
                    ...sites,
                    [`GET ${BP}/ai-crawlers`]: {
                        body: {
                            bot_protection: {
                                id: 'x',
                                ai_crawlers_blocking: 'enabled',
                            },
                        },
                    },
                },
            },
        );
        expect(r.stdout.trim()).toBe('block');
    });

    test('wp-automations allow sends enabled', async () => {
        const r = await runCli(
            [
                'security',
                'bot-protection',
                'wp-automations',
                'klant-x',
                'allow',
                '--env',
                'live',
            ],
            {
                routes: {
                    ...sites,
                    [`PUT ${BP}/wp-automations`]: started,
                    ...done,
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.calls.find((c) => c.method === 'PUT')?.body).toEqual({
            status: 'enabled',
        });
    });
});

describe('security bot-protection exceptions', () => {
    test('list prints the rules', async () => {
        const r = await runCli(
            [
                'security',
                'bot-protection',
                'exceptions',
                'list',
                'klant-x',
                '--env',
                'live',
            ],
            {
                routes: {
                    ...sites,
                    [`GET ${BP}/exception-rules`]: {
                        body: {
                            bot_protection: {
                                id: 'x',
                                has_custom_waf_rules: true,
                                exception_rules: [
                                    {
                                        id: 'ip:skip:192.0.2.1',
                                        type: 'ip',
                                        action: 'skip',
                                        value: '192.0.2.1',
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toMatch(
            /ip:skip:192\.0\.2\.1\s+ip\s+skip\s+192\.0\.2\.1/,
        );
        expect(r.stderr).toContain('This environment has custom WAF rules');
    });

    test('add sends type action and value', async () => {
        const r = await runCli(
            [
                'security',
                'bot-protection',
                'exceptions',
                'add',
                'klant-x',
                'ip',
                'skip',
                '192.0.2.1',
                '--env',
                'live',
            ],
            {
                routes: {
                    ...sites,
                    [`POST ${BP}/exception-rules`]: started,
                    ...done,
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.calls.find((c) => c.method === 'POST')?.body).toEqual({
            type: 'ip',
            action: 'skip',
            value: '192.0.2.1',
        });
    });

    test('delete needs --yes and sends exception_rule_id in the body', async () => {
        const routes = {
            ...sites,
            [`DELETE ${BP}/exception-rules`]: started,
            ...done,
        };
        const args = [
            'security',
            'bot-protection',
            'exceptions',
            'delete',
            'klant-x',
            'ip:skip:192.0.2.1',
            '--env',
            'live',
        ];
        const without = await runCli(args, {routes});
        expect(without.code).toBe(5);
        expect(without.calls.some((c) => c.method === 'DELETE')).toBe(false);

        const r = await runCli([...args, '--yes'], {routes});
        expect(r.code).toBe(0);
        expect(r.calls.find((c) => c.method === 'DELETE')?.body).toEqual({
            exception_rule_id: 'ip:skip:192.0.2.1',
        });
    });
});

// The spec makes operation_id optional for these four responses.
describe('security writes that answer without an operation_id', () => {
    const synchronous = {
        status: 200,
        body: {message: 'Applied', status: 200},
    };
    const cases: {
        name: string;
        args: string[];
        route: string;
        method: string;
    }[] = [
        {
            name: 'force-https',
            args: ['force-https', 'klant-x', 'off'],
            route: 'POST /sites/environments/env-live/force-https-status',
            method: 'POST',
        },
        {
            name: 'bot-protection level',
            args: ['bot-protection', 'level', 'klant-x', 'block-automations'],
            route: `PUT ${BP}/level`,
            method: 'PUT',
        },
        {
            name: 'exceptions add',
            args: [
                'bot-protection',
                'exceptions',
                'add',
                'klant-x',
                'ip',
                'skip',
                '192.0.2.1',
            ],
            route: `POST ${BP}/exception-rules`,
            method: 'POST',
        },
        {
            name: 'exceptions delete',
            args: [
                'bot-protection',
                'exceptions',
                'delete',
                'klant-x',
                'ip:skip:192.0.2.1',
                '--yes',
            ],
            route: `DELETE ${BP}/exception-rules`,
            method: 'DELETE',
        },
    ];

    test.each(cases)('$name succeeds', async ({args, route, method}) => {
        const r = await runCli(['security', ...args, '--env', 'live'], {
            routes: {...sites, [route]: synchronous},
        });
        expect(r.code).toBe(0);
        expect(r.calls.some((c) => c.method === method)).toBe(true);
        expect(
            r.calls.some((c) => c.url.pathname.includes('/operations')),
        ).toBe(false);
        expect(r.stdout).toContain('completed');
    });

    test.each(cases)(
        '$name prints one JSON document',
        async ({args, route}) => {
            const r = await runCli(
                ['security', ...args, '--env', 'live', '--json'],
                {routes: {...sites, [route]: synchronous}},
            );
            expect(r.code).toBe(0);
            expect(JSON.parse(r.stdout)).toEqual({
                message: 'Applied',
                status: 'completed',
            });
        },
    );
});
