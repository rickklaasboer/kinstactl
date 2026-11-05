import {describe, expect, test} from 'bun:test';
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

const T1 = new Date(2026, 9, 1, 9, 5).getTime();
const T2 = new Date(2026, 9, 3, 14, 30).getTime();

const BACKUPS = {
    environment: {
        display_name: 'Live',
        backups: [
            {id: 111, name: 'a', note: null, type: 'scheduled', created_at: T1},
            {
                id: 123,
                name: 'b',
                note: 'before',
                type: 'manual',
                created_at: T2,
            },
        ],
    },
};

const USERS = {
    company: {
        users: [
            {
                user: {
                    id: 'user-uuid-1',
                    email: 'rick@example.com',
                    image: '',
                    full_name: 'Rick',
                    type_2fa: null,
                },
                capabilities: [],
            },
            {
                user: {
                    id: 'user-uuid-2',
                    email: 'anna@example.com',
                    image: '',
                    full_name: 'Anna',
                    type_2fa: null,
                },
                capabilities: [],
            },
        ],
    },
};

const base = {
    'GET /sites': {body: SITES},
    'GET /sites/environments/env-live/backups': {body: BACKUPS},
    'GET /company/c1/users': {body: USERS},
};

const posts = <T extends {method: string}>(calls: T[]) =>
    calls.filter((c) => c.method !== 'GET');

describe('backups list', () => {
    test('sorts newest first and formats local time', async () => {
        const r = await runCli(['backups', 'list', 'klant-x'], {routes: base});
        expect(r.code).toBe(0);
        const lines = r.stdout.split('\n');
        const i123 = lines.findIndex((l) => l.includes('123'));
        const i111 = lines.findIndex((l) => l.includes('111'));
        expect(i123).toBeGreaterThan(-1);
        expect(i123).toBeLessThan(i111);
        expect(r.stdout).toContain('2026-10-03 14:30');
        expect(r.stdout).toContain('2026-10-01 09:05');
    });

    test('--type filters', async () => {
        const r = await runCli(
            ['backups', 'list', 'klant-x', '--type', 'manual', '--json'],
            {routes: base},
        );
        expect(JSON.parse(r.stdout).map((b: {id: number}) => b.id)).toEqual([
            123,
        ]);
    });
});

describe('backups create', () => {
    test('sends one creation request with the tag', async () => {
        const r = await runCli(
            ['backups', 'create', 'klant-x', '--tag', 'hello', '--json'],
            {
                routes: {
                    ...base,
                    'POST /sites/environments/env-live/manual-backups': {
                        status: 202,
                        body: {operation_id: 'op1'},
                    },
                    'GET /operations/op1': {status: 200},
                },
            },
        );
        expect(r.code).toBe(0);
        const sent = posts(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.body).toEqual({tag: 'hello'});
    });
});

describe('backups restore', () => {
    const restoreRoute = {
        'POST /sites/environments/env-live/backups/restore': {
            status: 202,
            body: {operation_id: 'op1'},
        },
        'GET /operations/op1': {status: 200},
    };

    test('non-interactive without --yes exits 5 and sends nothing', async () => {
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '123',
                '--notify',
                'rick@example.com',
                '--json',
            ],
            {routes: {...base, ...restoreRoute}},
        );
        expect(r.code).toBe(5);
        expect(JSON.parse(r.stderr).error.code).toBe('CONFIRMATION_REQUIRED');
        expect(JSON.parse(r.stderr).error.message).toContain(
            'Restore backup 123 (2026-10-03 14:30)',
        );
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('--yes --notify sends backup_id and notified_user_id', async () => {
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '123',
                '--yes',
                '--notify',
                'Rick@Example.com',
                '--json',
            ],
            {routes: {...base, ...restoreRoute}},
        );
        expect(r.code).toBe(0);
        const sent = posts(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.body).toEqual({
            backup_id: 123,
            notified_user_id: 'user-uuid-1',
        });
    });

    test('--dry-run non-interactive without --yes sends no POST and exits 0', async () => {
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '123',
                '--notify',
                'rick@example.com',
                '--dry-run',
                '--json',
            ],
            {routes: {...base, ...restoreRoute}},
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)).toHaveLength(0);
        expect(JSON.parse(r.stdout).dry_run).toBe(true);
    });

    test('unknown --notify exits 2 and lists user emails', async () => {
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '123',
                '--yes',
                '--notify',
                'nobody@example.com',
                '--json',
            ],
            {routes: {...base, ...restoreRoute}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.hints).toEqual([
            'rick@example.com',
            'anna@example.com',
        ]);
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('non-interactive without --notify exits 2 with a hint', async () => {
        const r = await runCli(
            ['backups', 'restore', 'klant-x', '123', '--yes', '--json'],
            {routes: {...base, ...restoreRoute}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.hints).toEqual([
            'Pass --notify <email>',
        ]);
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('interactive without --notify selects a user, then confirms', async () => {
        const r = await runCli(['backups', 'restore', 'klant-x', '123'], {
            routes: {...base, ...restoreRoute},
            tty: true,
            prompts: {
                select: (async (_m: string, options: {value: string}[]) =>
                    options[1]!.value) as never,
                confirm: async () => true,
            },
        });
        expect(r.code).toBe(0);
        expect(posts(r.calls)[0]!.body).toEqual({
            backup_id: 123,
            notified_user_id: 'user-uuid-2',
        });
    });

    test('unknown backup id exits 2', async () => {
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '999',
                '--yes',
                '--notify',
                'rick@example.com',
                '--json',
            ],
            {routes: {...base, ...restoreRoute}},
        );
        expect(r.code).toBe(2);
        const err = JSON.parse(r.stderr).error;
        expect(err.message).toBe('backup 999 not found on klant-x (live)');
        expect(err.hints).toEqual([]);
        expect(posts(r.calls)).toHaveLength(0);
    });
});

describe('backups restore --from-env', () => {
    const SITES_2ENV = {
        company: {
            sites: [
                {
                    id: 'site-1',
                    name: 'klant-x',
                    display_name: 'Klant X',
                    status: 'live',
                    environments: [
                        {id: 'env-live', name: 'live', display_name: 'Live'},
                        {
                            id: 'env-stg',
                            name: 'staging',
                            display_name: 'Staging',
                        },
                    ],
                },
            ],
        },
    };
    const EMPTY = {environment: {display_name: 'Live', backups: []}};
    const two = {
        'GET /sites': {body: SITES_2ENV},
        'GET /sites/environments/env-stg/backups': {body: BACKUPS},
        'GET /sites/environments/env-live/backups': {body: EMPTY},
        'GET /company/c1/users': {body: USERS},
        'POST /sites/environments/env-live/backups/restore': {
            status: 202,
            body: {operation_id: 'op1'},
        },
        'GET /operations/op1': {status: 200},
    };
    const gets = <T extends {method: string; url: URL}>(calls: T[]) =>
        calls
            .filter((c) => c.method === 'GET')
            .map((c) => c.url.pathname.replace(/^\/v2/, ''));

    test('restore --from-env looks the backup up on the source and restores onto --env', async () => {
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '123',
                '--from-env',
                'staging',
                '--env',
                'live',
                '--notify',
                'rick@example.com',
                '--yes',
                '--json',
            ],
            {routes: two},
        );
        expect(r.code).toBe(0);
        const sent = posts(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.url.pathname).toEndWith(
            '/sites/environments/env-live/backups/restore',
        );
        expect(sent[0]!.body).toEqual({
            backup_id: 123,
            notified_user_id: 'user-uuid-1',
        });
        expect(gets(r.calls)).toContain('/sites/environments/env-stg/backups');
        expect(gets(r.calls)).not.toContain(
            '/sites/environments/env-live/backups',
        );
    });

    test('restore --from-env with a backup missing on the source names the source', async () => {
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '123',
                '--from-env',
                'staging',
                '--env',
                'live',
                '--notify',
                'rick@example.com',
                '--yes',
                '--json',
            ],
            {
                routes: {
                    ...two,
                    'GET /sites/environments/env-stg/backups': {body: EMPTY},
                    'GET /sites/environments/env-live/backups': {
                        body: BACKUPS,
                    },
                },
            },
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.message).toBe(
            'backup 123 not found on klant-x (staging)',
        );
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('confirmation names both environments', async () => {
        let message = '';
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '123',
                '--from-env',
                'staging',
                '--env',
                'live',
                '--notify',
                'rick@example.com',
            ],
            {
                routes: two,
                tty: true,
                prompts: {
                    confirm: async (m: string) => {
                        message = m;
                        return true;
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(message).toContain('from staging');
        expect(message).toContain('(live)');
    });

    test('non-interactive without --yes exits 5, naming both, and sends nothing', async () => {
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '123',
                '--from-env',
                'staging',
                '--env',
                'live',
                '--notify',
                'rick@example.com',
                '--json',
            ],
            {routes: two},
        );
        expect(r.code).toBe(5);
        const message = JSON.parse(r.stderr).error.message;
        expect(message).toContain('from staging');
        expect(message).toContain('(live)');
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('--from-env equal to --env is a plain restore', async () => {
        const r = await runCli(
            [
                'backups',
                'restore',
                'klant-x',
                '123',
                '--from-env',
                'live',
                '--env',
                'live',
                '--notify',
                'rick@example.com',
                '--yes',
                '--json',
            ],
            {
                routes: {
                    ...two,
                    'GET /sites/environments/env-live/backups': {
                        body: BACKUPS,
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)).toHaveLength(1);
        expect(gets(r.calls)).not.toContain(
            '/sites/environments/env-stg/backups',
        );
    });
});

describe('backups delete', () => {
    const deleteRoute = {
        'DELETE /sites/environments/backups/123': {
            status: 202,
            body: {operation_id: 'op1'},
        },
        'GET /operations/op1': {status: 200},
    };

    test('non-interactive without --yes exits 5 and sends nothing', async () => {
        const r = await runCli(['backups', 'delete', 'klant-x', '123'], {
            routes: {...base, ...deleteRoute},
        });
        expect(r.code).toBe(5);
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('--yes sends the delete', async () => {
        const r = await runCli(
            ['backups', 'delete', 'klant-x', '123', '--yes', '--json'],
            {routes: {...base, ...deleteRoute}},
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)).toHaveLength(1);
    });
});

test('backups help has examples', async () => {
    const r = await runCli(['backups', 'restore', '--help']);
    expect(r.stdout).toContain('Examples:');
});
