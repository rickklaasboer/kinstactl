import {describe, expect, test} from 'bun:test';
import {done, SITES_ROUTES, started} from '../../helpers/fixtures';
import {runCli} from '../../helpers/runCli';

const T1 = new Date(2026, 9, 1, 9, 5).getTime();
const T2 = new Date(2026, 9, 3, 14, 30).getTime();
const EXPIRES = new Date(2026, 9, 10, 8, 0).getTime();

const LIST = {
    environment: {
        display_name: 'Live',
        downloadable_backups: [
            {
                id: 'old',
                created_at: T1,
                download_link: 'https://dl.example.com/old.zip',
                expires_at: EXPIRES,
                is_generation_in_progress: false,
            },
            {
                id: 'new',
                created_at: T2,
                download_link: 'https://dl.example.com/new.zip',
                expires_at: EXPIRES,
                is_generation_in_progress: false,
            },
            {
                id: 'busy',
                created_at: T2,
                download_link: null,
                expires_at: EXPIRES,
                is_generation_in_progress: true,
            },
        ],
    },
};

const LIST_ROUTE = 'GET /sites/environments/env-live/downloadable-backups';
const POST_ROUTE = 'POST /sites/environments/env-live/downloadable-backups';

describe('backups downloadable list', () => {
    test('list shows links and generating state', async () => {
        const r = await runCli(
            ['backups', 'downloadable', 'list', 'klant-x', '--env', 'live'],
            {routes: {...SITES_ROUTES, [LIST_ROUTE]: {body: LIST}}},
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('https://dl.example.com/new.zip');
        expect(r.stdout).toContain('generating');
        expect(r.stdout).toContain('2026-10-03 14:30');
        expect(r.stdout).toContain('2026-10-10 08:00');
    });

    test('--json prints the downloadable_backups array', async () => {
        const r = await runCli(
            [
                'backups',
                'downloadable',
                'list',
                'klant-x',
                '--env',
                'live',
                '--json',
            ],
            {routes: {...SITES_ROUTES, [LIST_ROUTE]: {body: LIST}}},
        );
        expect(JSON.parse(r.stdout)).toEqual(
            LIST.environment.downloadable_backups,
        );
    });
});

describe('backups downloadable create', () => {
    test('create waits and prints the newest link', async () => {
        const r = await runCli(
            ['backups', 'downloadable', 'create', 'klant-x', '--env', 'live'],
            {
                routes: {
                    ...SITES_ROUTES,
                    [POST_ROUTE]: started('op1'),
                    ...done('op1'),
                    [LIST_ROUTE]: {body: LIST},
                },
            },
        );
        expect(r.code).toBe(0);
        expect(
            r.stdout.trimEnd().endsWith('https://dl.example.com/new.zip'),
        ).toBe(true);
        const order = r.calls
            .map((c) => `${c.method} ${c.url.pathname.replace(/^\/v2/, '')}`)
            .filter((k) => k !== 'GET /sites');
        expect(order).toEqual([
            'POST /sites/environments/env-live/downloadable-backups',
            'GET /operations/op1',
            'GET /sites/environments/env-live/downloadable-backups',
        ]);
    });

    test('create --json prints one document with the operation id and link', async () => {
        const r = await runCli(
            [
                'backups',
                'downloadable',
                'create',
                'klant-x',
                '--env',
                'live',
                '--json',
            ],
            {
                routes: {
                    ...SITES_ROUTES,
                    [POST_ROUTE]: started('op1'),
                    ...done('op1'),
                    [LIST_ROUTE]: {body: LIST},
                },
            },
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual({
            operation_id: 'op1',
            status: 'completed',
            download_link: 'https://dl.example.com/new.zip',
            expires_at: EXPIRES,
        });
    });

    test('create --no-wait prints the operation id and does not list', async () => {
        const r = await runCli(
            [
                'backups',
                'downloadable',
                'create',
                'klant-x',
                '--env',
                'live',
                '--no-wait',
                '--json',
            ],
            {
                routes: {
                    ...SITES_ROUTES,
                    [POST_ROUTE]: started('op1'),
                    [LIST_ROUTE]: {body: LIST},
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('op1');
        expect(
            r.calls.some(
                (c) =>
                    c.url.pathname.endsWith('/downloadable-backups') &&
                    c.method === 'GET',
            ),
        ).toBe(false);
    });
});

describe('backups downloadable quota', () => {
    const QUOTA =
        'GET /sites/environments/env-live/next-downloadable-backup-available';

    test('quota prints reset_at when unavailable', async () => {
        const r = await runCli(
            ['backups', 'downloadable', 'quota', 'klant-x', '--env', 'live'],
            {
                routes: {
                    ...SITES_ROUTES,
                    [QUOTA]: {
                        body: {
                            is_backup_available: false,
                            reset_at: '10/10/2026, 06:16 AM UTC',
                        },
                    },
                },
            },
        );
        expect(r.code).toBe(0);
        expect(r.stdout).toContain(
            'next available at 10/10/2026, 06:16 AM UTC',
        );
    });

    test('quota prints available and the raw body as JSON', async () => {
        const body = {is_backup_available: true, reset_at: null};
        const routes = {...SITES_ROUTES, [QUOTA]: {body}};
        const human = await runCli(
            ['backups', 'downloadable', 'quota', 'klant-x', '--env', 'live'],
            {routes},
        );
        expect(human.stdout.trim()).toBe('available');
        const json = await runCli(
            [
                'backups',
                'downloadable',
                'quota',
                'klant-x',
                '--env',
                'live',
                '--json',
            ],
            {routes},
        );
        expect(JSON.parse(json.stdout)).toEqual(body);
    });
});
