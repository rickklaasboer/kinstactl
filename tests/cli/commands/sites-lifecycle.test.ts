import {describe, expect, test} from 'bun:test';
import {done, SITES_ROUTES, started} from '../../helpers/fixtures';
import {runCli} from '../../helpers/runCli';

const REGIONS = {
    'GET /company/c1/available-regions': {
        body: {
            company: {
                available_regions: [
                    {name: 'Europe West 4', region: 'europe-west4'},
                ],
            },
        },
    },
};

const posts = <T extends {method: string}>(calls: T[]) =>
    calls.filter((c) => c.method !== 'GET');

const WP_FLAGS = [
    '--admin-user',
    'admin',
    '--admin-email',
    'a@b.nl',
    '--admin-password',
    '-',
];

describe('sites create', () => {
    const routes = {
        ...SITES_ROUTES,
        ...REGIONS,
        'POST /sites': started('op1'),
        'POST /sites/plain': started('op1'),
        ...done('op1'),
    };

    test('sends install_mode new with the wp fields', async () => {
        const r = await runCli(
            [
                'sites',
                'create',
                'Klant Y',
                '--region',
                'europe-west4',
                ...WP_FLAGS,
                '--json',
            ],
            {routes, io: {stdin: async () => 's3cret\n'}},
        );
        expect(r.code).toBe(0);
        const sent = posts(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.url.pathname).toBe('/v2/sites');
        expect(sent[0]!.body).toEqual({
            company: 'c1',
            display_name: 'Klant Y',
            region: 'europe-west4',
            install_mode: 'new',
            admin_user: 'admin',
            admin_email: 'a@b.nl',
            admin_password: 's3cret',
            site_title: 'Klant Y',
            wp_language: 'en_US',
        });
    });

    test('--plain uses /sites/plain and needs no admin fields', async () => {
        const r = await runCli(
            [
                'sites',
                'create',
                'Klant Y',
                '--region',
                'europe-west4',
                '--plain',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        const sent = posts(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.url.pathname).toBe('/v2/sites/plain');
        expect(sent[0]!.body).toEqual({
            company: 'c1',
            display_name: 'Klant Y',
            region: 'europe-west4',
        });
    });

    test('--dry-run redacts the password', async () => {
        const r = await runCli(
            [
                'sites',
                'create',
                'Klant Y',
                '--region',
                'europe-west4',
                ...WP_FLAGS,
                '--dry-run',
                '--json',
            ],
            {routes, io: {stdin: async () => 's3cret\n'}},
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout).request.body.admin_password).toBe('***');
        expect(r.stdout).not.toContain('s3cret');
        expect(posts(r.calls)).toEqual([]);
    });

    test('--no-wait with --dry-run absent still sends the real password', async () => {
        const r = await runCli(
            [
                'sites',
                'create',
                'Klant Y',
                '--region',
                'europe-west4',
                ...WP_FLAGS,
                '--no-wait',
                '--json',
            ],
            {routes, io: {stdin: async () => 's3cret\n'}},
        );
        expect(r.code).toBe(0);
        expect(
            (posts(r.calls)[0]!.body as {admin_password: string})
                .admin_password,
        ).toBe('s3cret');
        expect(r.stdout).not.toContain('s3cret');
    });

    test('an unknown region exits 2 with the valid regions as hints', async () => {
        const r = await runCli(
            [
                'sites',
                'create',
                'Klant Y',
                '--region',
                'mars-1',
                '--plain',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(2);
        const err = JSON.parse(r.stderr).error;
        expect(err.code).toBe('USAGE');
        expect(err.hints.join(' ')).toContain('europe-west4');
        expect(posts(r.calls)).toEqual([]);
    });

    test('a missing region without a TTY exits 2 with the regions as hints', async () => {
        const r = await runCli(
            ['sites', 'create', 'Klant Y', '--plain', '--json'],
            {routes},
        );
        expect(r.code).toBe(2);
        const err = JSON.parse(r.stderr).error;
        expect(err.message).toContain('Missing --region');
        expect(err.hints.join(' ')).toContain('europe-west4');
        expect(posts(r.calls)).toEqual([]);
    });

    test('a missing region on a TTY opens the picker', async () => {
        const r = await runCli(
            ['sites', 'create', 'Klant Y', '--plain', '--no-wait'],
            {
                routes,
                tty: true,
                prompts: {select: async (_m, options) => options[0]!.value},
            },
        );
        expect(r.code).toBe(0);
        expect((posts(r.calls)[0]!.body as {region: string}).region).toBe(
            'europe-west4',
        );
    });

    test('without a password and without a TTY exits 2 and sends nothing', async () => {
        const r = await runCli(
            [
                'sites',
                'create',
                'Klant Y',
                '--region',
                'europe-west4',
                '--admin-user',
                'admin',
                '--admin-email',
                'a@b.nl',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(posts(r.calls)).toEqual([]);
    });

    test('a missing admin user exits 2 naming the flag', async () => {
        const r = await runCli(
            [
                'sites',
                'create',
                'Klant Y',
                '--region',
                'europe-west4',
                '--admin-email',
                'a@b.nl',
                '--admin-password',
                'x',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.message).toContain('--admin-user');
        expect(posts(r.calls)).toEqual([]);
    });
});

describe('sites clone', () => {
    test('sends the source environment id', async () => {
        const r = await runCli(
            [
                'sites',
                'clone',
                'klant-x',
                'Klant Y',
                '--env',
                'staging',
                '--json',
            ],
            {
                routes: {
                    ...SITES_ROUTES,
                    'POST /sites/clone': started('op1'),
                    ...done('op1'),
                },
            },
        );
        expect(r.code).toBe(0);
        const sent = posts(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.body).toEqual({
            company: 'c1',
            display_name: 'Klant Y',
            source_env_id: 'env-stg',
        });
    });
});

describe('sites delete', () => {
    const routes = {
        ...SITES_ROUTES,
        'DELETE /sites/id-x': started('op1'),
        ...done('op1'),
    };

    test('needs --confirm with the site name', async () => {
        const none = await runCli(['sites', 'delete', 'klant-x', '--json'], {
            routes,
        });
        expect(none.code).toBe(5);
        expect(posts(none.calls)).toEqual([]);

        // --yes is not registered on irreversible commands: Commander rejects it.
        const yes = await runCli(
            ['sites', 'delete', 'klant-x', '--yes', '--json'],
            {routes},
        );
        expect(yes.code).toBe(2);
        expect(yes.calls).toEqual([]);

        const wrong = await runCli(
            ['sites', 'delete', 'klant-x', '--confirm', 'klant-y', '--json'],
            {routes},
        );
        expect(wrong.code).toBe(5);
        expect(posts(wrong.calls)).toEqual([]);

        const ok = await runCli(
            ['sites', 'delete', 'klant-x', '--confirm', 'klant-x', '--json'],
            {routes},
        );
        expect(ok.code).toBe(0);
        const sent = posts(ok.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]!.method).toBe('DELETE');
        expect(sent[0]!.url.pathname).toBe('/v2/sites/id-x');
    });

    test('--dry-run sends nothing regardless of --confirm', async () => {
        const r = await runCli(
            [
                'sites',
                'delete',
                'klant-x',
                '--confirm',
                'klant-x',
                '--dry-run',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)).toEqual([]);
    });
});

describe('sites reset', () => {
    const routes = {
        ...SITES_ROUTES,
        'POST /sites/id-x/reset-site': started('op1'),
        ...done('op1'),
    };

    test('is irreversible and redacts the password', async () => {
        const dry = await runCli(
            [
                'sites',
                'reset',
                'klant-x',
                '--admin-password',
                'x',
                '--dry-run',
                '--json',
            ],
            {routes},
        );
        expect(dry.code).toBe(0);
        expect(JSON.parse(dry.stdout).request.body).toEqual({
            admin_password: '***',
        });
        expect(posts(dry.calls)).toEqual([]);

        const yes = await runCli(
            [
                'sites',
                'reset',
                'klant-x',
                '--admin-password',
                'x',
                '--yes',
                '--json',
            ],
            {routes},
        );
        expect(yes.code).toBe(2);
        expect(yes.calls).toEqual([]);

        const noConfirm = await runCli(
            ['sites', 'reset', 'klant-x', '--admin-password', 'x', '--json'],
            {routes},
        );
        expect(noConfirm.code).toBe(5);
        expect(posts(noConfirm.calls)).toEqual([]);

        const real = await runCli(
            [
                'sites',
                'reset',
                'klant-x',
                '--admin-password',
                'x',
                '--confirm',
                'klant-x',
                '--json',
            ],
            {routes},
        );
        expect(real.code).toBe(0);
        expect(posts(real.calls)[0]!.body).toEqual({admin_password: 'x'});
    });

    test('without a password and without a TTY exits 2 and sends nothing', async () => {
        const r = await runCli(
            ['sites', 'reset', 'klant-x', '--confirm', 'klant-x', '--json'],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(posts(r.calls)).toEqual([]);
    });

    test('an empty literal password exits 2', async () => {
        const r = await runCli(
            [
                'sites',
                'reset',
                'klant-x',
                '--admin-password',
                '',
                '--confirm',
                'klant-x',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(posts(r.calls)).toEqual([]);
    });
});

describe('sites php-allocation', () => {
    const routes = {
        ...SITES_ROUTES,
        'POST /sites/id-x/change-site-php-allocation': started('op1'),
        ...done('op1'),
    };

    test('sends thread_count and thread_memory', async () => {
        const r = await runCli(
            [
                'sites',
                'php-allocation',
                'klant-x',
                '--threads',
                '4',
                '--memory',
                '256',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)[0]!.body).toEqual({
            thread_count: 4,
            thread_memory: 256,
        });
    });

    test('rejects a non-positive thread count', async () => {
        const r = await runCli(
            [
                'sites',
                'php-allocation',
                'klant-x',
                '--threads',
                '0',
                '--memory',
                '256',
                '--json',
            ],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(posts(r.calls)).toEqual([]);
    });
});
