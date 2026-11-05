import {describe, expect, test} from 'bun:test';
import type {FakeCall} from '../../helpers/fakeKinsta';
import {runCli} from '../../helpers/runCli';

const ENV = '/sites/environments/env-live/additional-sftp-accounts';

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

const accounts = {
    environment: {
        additional_sftp_accounts: [
            {
                id: 'a1',
                username: 'Alice',
                root_directory: '/',
                is_active: true,
                permission: 'write',
            },
            {
                id: 'a2',
                username: 'bob',
                root_directory: '/wp-content',
                is_active: false,
                permission: 'read',
            },
        ],
        container_info: {additional_sftp_accounts_port: '12374'},
    },
};

const listRoute = {[`GET ${ENV}`]: {body: accounts}};

const op = (method: string, path: string) => ({
    [`${method} ${path}`]: {status: 202, body: {operation_id: 'op1'}},
    'GET /operations/op1': {status: 200},
});

const writes = (calls: FakeCall[]) => calls.filter((c) => c.method !== 'GET');

describe('sftp-users list', () => {
    test('list shows accounts, the enabled state and the port', async () => {
        const r = await runCli(['sftp-users', 'list', 'my-site'], {
            routes: {
                ...sites,
                ...listRoute,
                'GET /sites/id-x/environments': {
                    body: {
                        site: {
                            environments: [
                                {
                                    id: 'env-live',
                                    name: 'live',
                                    is_additional_sftp_accounts_enabled: true,
                                },
                            ],
                        },
                    },
                },
            },
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('USERNAME');
        expect(r.stdout).toContain('Alice');
        expect(r.stdout).toContain('/wp-content');
        expect(r.stdout).toContain('a2');
        expect(r.stderr + r.stdout).toContain(
            'Additional SFTP accounts are enabled; port 12374',
        );
    });
});

describe('sftp-users add', () => {
    const routes = {...sites, ...op('POST', ENV)};

    test('add reads the password from stdin and redacts it in dry-run', async () => {
        const io = {stdin: async () => 's3cret\n'};
        const args = [
            'sftp-users',
            'add',
            'my-site',
            'carol',
            '--password',
            '-',
            '--root-directory',
            '/dir',
            '--permission',
            'write',
        ];
        const dry = await runCli([...args, '--dry-run'], {routes, io});
        expect(dry.code).toBe(0);
        expect(writes(dry.calls)).toHaveLength(0);
        expect(dry.stdout + dry.stderr).toContain('***');
        expect(dry.stdout + dry.stderr).not.toContain('s3cret');

        const real = await runCli([...args, '--no-wait'], {routes, io});
        expect(real.code).toBe(0);
        expect(real.stdout + real.stderr).not.toContain('s3cret');
        const sent = writes(real.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.body).toEqual({
            username: 'carol',
            password: 's3cret',
            root_directory: '/dir',
            permission: 'write',
        });
    });

    test('add with empty stdin exits 2 and sends nothing', async () => {
        const r = await runCli(
            ['sftp-users', 'add', 'my-site', 'carol', '--password', '-'],
            {routes, io: {stdin: async () => '\n'}},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });

    test('add prompts secretly on a TTY', async () => {
        let secret: boolean | undefined;
        const r = await runCli(['sftp-users', 'add', 'my-site', 'carol'], {
            routes,
            tty: true,
            prompts: {
                text: async (_m, o) => {
                    secret = o?.secret;
                    return 'typed-pass';
                },
            },
        });
        expect(r.code).toBe(0);
        expect(secret).toBe(true);
        expect(writes(r.calls)[0]?.body).toEqual({
            username: 'carol',
            password: 'typed-pass',
        });
    });

    test('add rejects an unknown permission', async () => {
        const r = await runCli(
            [
                'sftp-users',
                'add',
                'my-site',
                'carol',
                '--password',
                'x',
                '--permission',
                'admin',
            ],
            {routes},
        );
        expect(r.code).toBe(2);
        expect(writes(r.calls)).toHaveLength(0);
    });
});

describe('sftp-users enable/disable', () => {
    test('enable sends enabled true', async () => {
        const r = await runCli(['sftp-users', 'enable', 'my-site', '--json'], {
            routes: {...sites, ...op('PUT', `${ENV}/toggle-status`)},
        });
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.method).toBe('PUT');
        expect(sent[0]?.body).toEqual({enabled: true});
    });

    test('disable sends enabled false', async () => {
        const r = await runCli(['sftp-users', 'disable', 'my-site', '--json'], {
            routes: {...sites, ...op('PUT', `${ENV}/toggle-status`)},
        });
        expect(r.code).toBe(0);
        expect(writes(r.calls)[0]?.body).toEqual({enabled: false});
    });
});

describe('sftp-users delete', () => {
    const delPath = '/sites/environments/additional-sftp-accounts/a1';
    const routes = {...sites, ...listRoute, ...op('DELETE', delPath)};

    test('delete resolves the username and needs --yes', async () => {
        const refused = await runCli(
            ['sftp-users', 'delete', 'my-site', 'alice'],
            {routes},
        );
        expect(refused.code).toBe(5);
        expect(writes(refused.calls)).toHaveLength(0);

        const r = await runCli(
            ['sftp-users', 'delete', 'my-site', 'alice', '--yes', '--json'],
            {routes},
        );
        expect(r.code).toBe(0);
        const sent = writes(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.method).toBe('DELETE');
        expect(sent[0]?.url.pathname.endsWith(delPath)).toBe(true);
    });

    test('delete of an unknown username lists the existing ones', async () => {
        const r = await runCli(
            ['sftp-users', 'delete', 'my-site', 'zed', '--yes', '--json'],
            {routes},
        );
        expect(r.code).toBe(2);
        const err = JSON.parse(r.stderr).error;
        expect(err.message).toContain(
            'no SFTP account "zed" on my-site (live)',
        );
        expect(err.hints).toEqual(['Alice', 'bob']);
        expect(writes(r.calls)).toHaveLength(0);
    });
});
