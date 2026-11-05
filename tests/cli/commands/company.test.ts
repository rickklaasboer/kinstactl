import {describe, expect, test} from 'bun:test';
import {SITES_ROUTES} from '../../helpers/fixtures';
import {runCli} from '../../helpers/runCli';

const USERS = {
    company: {
        users: [
            {
                user: {
                    id: 'u1',
                    email: 'jan@example.com',
                    full_name: 'Jan Jansen',
                    type_2fa: 'email',
                },
                capabilities: [
                    {role: 'company-admin'},
                    {role: 'company-billing'},
                ],
            },
            {
                user: {
                    id: 'u2',
                    email: 'jana@example.com',
                    full_name: 'Jana Smit',
                    type_2fa: null,
                },
                capabilities: [{role: 'company-developer'}],
            },
        ],
    },
};

const usersRoute = {'GET /company/c1/users': {body: USERS}};

const writes = <T extends {method: string}>(calls: T[]) =>
    calls.filter((c) => c.method !== 'GET');

describe('company users list', () => {
    test('shows roles', async () => {
        const r = await runCli(['company', 'users', 'list'], {
            routes: usersRoute,
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('EMAIL');
        expect(r.stdout).toContain('company-admin, company-billing');
        expect(r.stdout).toContain('u2');
    });
});

describe('company users get', () => {
    const routes = {
        ...usersRoute,
        'GET /company/c1/users/u1': {
            body: {
                company: {
                    user_by_id: {
                        user: {
                            id: 'u1',
                            email: 'jan@example.com',
                            full_name: 'Jan Jansen',
                            type_2fa: null,
                        },
                        capabilities: [
                            {
                                role: 'company-admin',
                                id_company: 'c1',
                                id_site: null,
                            },
                            {
                                role: 'site-developer',
                                id_company: null,
                                id_site: 'id-x',
                            },
                        ],
                    },
                },
            },
        },
    };

    test('resolves an email', async () => {
        const r = await runCli(['company', 'users', 'get', 'JAN@example.com'], {
            routes,
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('Email: jan@example.com');
        expect(r.stdout).toContain('2FA:   off');
        expect(r.stdout).toContain('site-developer');
        expect(r.stdout).toContain('id-x');
    });

    test('with an ambiguous prefix lists candidates', async () => {
        const r = await runCli(['company', 'users', 'get', 'jan', '--json'], {
            routes,
        });
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.hints).toEqual([
            'jan@example.com',
            'jana@example.com',
        ]);
    });
});

describe('company users role', () => {
    const role = {
        ...usersRoute,
        'POST /company/c1/users/company-capabilities': {
            status: 202,
            body: {operation_id: 'op1', message: 'ok', status: 202},
        },
        'GET /operations/op1': {
            status: 200,
            body: {message: 'ok', status: 200},
        },
    };

    test('sends user_id and role and waits on an operation_id', async () => {
        const r = await runCli(
            ['company', 'users', 'role', 'jan@example.com', 'company-billing'],
            {routes: role},
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls).map((c) => c.body)).toEqual([
            {user_id: 'u1', role: 'company-billing'},
        ]);
        expect(
            r.calls.some((c) => c.url.pathname.endsWith('/operations/op1')),
        ).toBe(true);
        expect(r.stdout).toContain('jan@example.com is now company-billing');
    });

    test('completes immediately without an operation_id', async () => {
        const r = await runCli(
            ['company', 'users', 'role', 'jan@example.com', 'company-billing'],
            {
                routes: {
                    ...usersRoute,
                    'POST /company/c1/users/company-capabilities': {
                        body: {message: 'ok', status: 200},
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(
            r.calls.some((c) => c.url.pathname.includes('/operations')),
        ).toBe(false);
        expect(r.stdout).toContain('jan@example.com is now company-billing');
    });
});

describe('company users site-role', () => {
    test('sends site_capabilities', async () => {
        const r = await runCli(
            [
                'company',
                'users',
                'site-role',
                'jan@example.com',
                'klant-x',
                'site-developer',
            ],
            {
                routes: {
                    ...usersRoute,
                    ...SITES_ROUTES,
                    'POST /company/c1/users/site-capabilities': {
                        body: {message: 'ok', status: 200},
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(writes(r.calls).map((c) => c.body)).toEqual([
            {
                user_ids: ['u1'],
                site_capabilities: [{site_id: 'id-x', role: 'site-developer'}],
            },
        ]);
    });
});

describe('company api-keys', () => {
    test('lists', async () => {
        const r = await runCli(['company', 'api-keys'], {
            routes: {
                'GET /company/c1/api-keys': {
                    body: {
                        api_keys: [
                            {
                                id: 'k1',
                                name: 'CI key',
                                status: 'active',
                                expires_at: null,
                            },
                            {
                                id: 'k2',
                                name: 'Old key',
                                status: 'expired',
                                expires_at: '2025-01-01T00:00:00Z',
                            },
                        ],
                    },
                },
            },
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('CI key');
        expect(r.stdout).toContain('never');
        expect(r.stdout).toContain('2025-01-01T00:00:00Z');
    });
});

describe('company regions', () => {
    test('lists', async () => {
        const r = await runCli(['company', 'regions'], {
            routes: {
                'GET /company/c1/available-regions': {
                    body: {
                        company: {
                            available_regions: [
                                {
                                    name: 'Dallas US (us-south1)',
                                    region: 'us-south1',
                                },
                            ],
                        },
                    },
                },
            },
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('REGION');
        expect(r.stdout).toContain('us-south1');
        expect(r.stdout).toContain('Dallas US (us-south1)');
    });
});

describe('company activity', () => {
    test('passes the query and resolves --site', async () => {
        const r = await runCli(
            [
                'company',
                'activity',
                '--limit',
                '5',
                '--offset',
                '2',
                '--category',
                'siteActions',
                '--site',
                'klant-x',
                '--language',
                'nl',
            ],
            {
                routes: {
                    ...SITES_ROUTES,
                    'GET /company/c1/activity-logs': {
                        body: {
                            company: {
                                activity_logs: {
                                    total: 42,
                                    items: [
                                        {
                                            id: 1,
                                            site_id: 'id-x',
                                            created_at: 1665382600770,
                                            is_done: true,
                                            has_failed: false,
                                            has_warning: false,
                                            type: 'deleteSite',
                                            initiated_by: {
                                                id: 'u1',
                                                full_name: 'Jan Jansen',
                                            },
                                        },
                                        {
                                            id: 2,
                                            site_id: null,
                                            created_at: 1665382700770,
                                            is_done: false,
                                            has_failed: true,
                                            has_warning: false,
                                            type: 'createSite',
                                            api_key_info: {
                                                id: 'k1',
                                                name: 'CI key',
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        const call = r.calls.find((c) =>
            c.url.pathname.endsWith('/activity-logs'),
        )!;
        expect(Object.fromEntries(call.url.searchParams)).toEqual({
            limit: '5',
            offset: '2',
            category: 'siteActions',
            site_id: 'id-x',
            language: 'nl',
        });
        expect(r.stdout).toContain('deleteSite');
        expect(r.stdout).toContain('Jan Jansen');
        expect(r.stdout).toContain('CI key');
        expect(r.stdout).toContain('failed');
        expect(r.stdout).toContain('done');
        expect(r.stderr).toContain('2 of 42');
    });

    test('defaults to 10 entries', async () => {
        const r = await runCli(['company', 'activity'], {
            routes: {
                'GET /company/c1/activity-logs': {
                    body: {company: {activity_logs: {items: [], total: 0}}},
                },
            },
        });
        expect(r.code).toBe(0);
        expect(r.calls[0]!.url.searchParams.get('limit')).toBe('10');
    });

    test('rejects an unknown category', async () => {
        const r = await runCli(['company', 'activity', '--category', 'nope']);
        expect(r.code).toBe(2);
    });
});

const item = (name: string, updates: number, vulnerable: boolean) => ({
    name,
    title: name.toUpperCase(),
    description: '',
    latest_version: '1.0',
    is_latest_version_vulnerable: vulnerable,
    environment_count: 3,
    update_count: updates,
    environments: [],
});

describe('company plugins and themes', () => {
    const inventory = (
        kind: 'plugins' | 'themes',
        items: unknown[],
    ): Record<string, {body: unknown}> => ({
        [`GET /company/c1/wp-${kind}`]: {
            body: {
                company: {
                    [kind]: {
                        total: items.length,
                        last_updated_at: '2026-01-01T12:00:00Z',
                        items,
                    },
                },
            },
        },
    });

    test('plugins sends no body and shows the last update when empty', async () => {
        const r = await runCli(['company', 'plugins'], {
            routes: inventory('plugins', []),
        });
        expect(r.code).toBe(0);
        expect(r.calls[0]!.method).toBe('GET');
        expect(r.calls[0]!.body).toBeUndefined();
        expect(r.stdout).toContain(
            'No plugins in the inventory (last updated 2026-01-01T12:00:00Z)',
        );
    });

    test('plugins --updates filters client-side', async () => {
        const r = await runCli(['company', 'plugins', '--updates'], {
            routes: inventory('plugins', [
                item('akismet', 0, false),
                item('elementor', 2, false),
            ]),
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('ELEMENTOR');
        expect(r.stdout).not.toContain('AKISMET');
        expect(r.stdout).toContain('ENVIRONMENTS');
    });

    test('themes --vulnerable filters client-side', async () => {
        const r = await runCli(['company', 'themes', '--vulnerable'], {
            routes: inventory('themes', [
                item('astra', 0, true),
                item('hello', 0, false),
            ]),
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('ASTRA');
        expect(r.stdout).toContain('yes');
        expect(r.stdout).not.toContain('HELLO');
    });
});
