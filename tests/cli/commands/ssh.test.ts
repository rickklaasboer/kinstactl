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

const posts = (calls: FakeCall[]) => calls.filter((c) => c.method !== 'GET');

const allowlist = (ips: string[]) => ({
    'GET /sites/environments/env-live/ssh/get-allowed-ips': {
        body: {environment: {active_container: {sftp_ip_allowlist: ips}}},
    },
    'POST /sites/environments/env-live/ssh/set-allowed-ips': {
        body: {result: null},
    },
});

describe('ssh status', () => {
    const routes = {
        ...sites,
        'GET /sites/environments/env-live/ssh/get-status': {
            body: {environment: {active_container: {is_ssh_enabled: true}}},
        },
    };

    test('prints enabled', async () => {
        const r = await runCli(['ssh', 'status', 'klant-x'], {routes});
        expect(r.code).toBe(0);
        expect(r.stdout.trim()).toBe('enabled');
    });

    test('json carries site, environment and flag', async () => {
        const r = await runCli(['ssh', 'status', 'klant-x', '--json'], {
            routes,
        });
        expect(JSON.parse(r.stdout)).toEqual({
            site: 'klant-x',
            environment: 'live',
            is_ssh_enabled: true,
        });
    });
});

describe('ssh enable/disable', () => {
    const routes = {
        ...sites,
        'POST /sites/environments/env-live/ssh/set-status': {
            body: {result: null},
        },
    };

    test('enable sends is_enabled true and no operation is polled', async () => {
        const r = await runCli(['ssh', 'enable', 'klant-x'], {routes});
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('SSH enabled');
        const sent = posts(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.body).toEqual({is_enabled: true});
        expect(
            r.calls.some((c) => c.url.pathname.includes('/operations/')),
        ).toBe(false);
    });

    test('disable --dry-run sends nothing', async () => {
        const r = await runCli(['ssh', 'disable', 'klant-x', '--dry-run'], {
            routes,
        });
        expect(r.code).toBe(0);
        expect(posts(r.calls)).toHaveLength(0);
        expect(r.stdout).toContain('Nothing was sent');
    });
});

describe('ssh config', () => {
    const config = (activeContainer?: object) => ({
        ...sites,
        'GET /sites/id-x/environments/env-live/ssh/config': {
            body: {
                site: {
                    id: 'id-x',
                    name: 'klant-x',
                    displayName: 'Klant X',
                    usr: 'klantx',
                    environment: {id: 'env-live', activeContainer},
                },
            },
        },
    });

    test('prints the ssh command from the nested shape', async () => {
        const r = await runCli(['ssh', 'config', 'klant-x', '--json'], {
            routes: config({
                id: 'c1',
                lxdSshPort: '12345',
                loadBalancer: {id: 'lb1', extIP: '203.0.113.9'},
            }),
        });
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual({
            host: '203.0.113.9',
            port: '12345',
            user: 'klantx',
            ssh_command: 'ssh klantx@203.0.113.9 -p 12345',
        });
    });

    test('human output has Host, Port and User lines', async () => {
        const r = await runCli(['ssh', 'config', 'klant-x'], {
            routes: config({
                id: 'c1',
                lxdSshPort: '12345',
                loadBalancer: {id: 'lb1', extIP: '203.0.113.9'},
            }),
        });
        expect(r.stdout.trim().split('\n')).toEqual([
            'Host: 203.0.113.9',
            'Port: 12345',
            'User: klantx',
            'ssh klantx@203.0.113.9 -p 12345',
        ]);
    });

    test('without connection details is an api error', async () => {
        const r = await runCli(['ssh', 'config', 'klant-x', '--json'], {
            routes: config(undefined),
        });
        expect(r.code).toBe(1);
        const {error} = JSON.parse(r.stderr);
        expect(error.code).toBe('API_ERROR');
        expect(error.message).toBe('Response has no SSH connection details');
    });
});

describe('ssh allowlist', () => {
    test('prints the list', async () => {
        const r = await runCli(['ssh', 'allowlist', 'klant-x'], {
            routes: {...sites, ...allowlist(['1.1.1.1', '2.2.2.2'])},
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toBe('1.1.1.1\n2.2.2.2\n');
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('--add appends and sends the merged list', async () => {
        const r = await runCli(
            ['ssh', 'allowlist', 'klant-x', '--add', '2.2.2.2'],
            {routes: {...sites, ...allowlist(['1.1.1.1'])}},
        );
        expect(r.code).toBe(0);
        const sent = posts(r.calls);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.body).toEqual({ip_allowlist: ['1.1.1.1', '2.2.2.2']});
        expect(r.stdout).toContain('Allowlist updated');
    });

    test('--remove drops the entry', async () => {
        const r = await runCli(
            ['ssh', 'allowlist', 'klant-x', '--remove', '1.1.1.1'],
            {routes: {...sites, ...allowlist(['1.1.1.1', '2.2.2.2'])}},
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)[0]?.body).toEqual({ip_allowlist: ['2.2.2.2']});
    });

    test('--add of a present ip is a usage error', async () => {
        const r = await runCli(
            ['ssh', 'allowlist', 'klant-x', '--add', '1.1.1.1', '--json'],
            {routes: {...sites, ...allowlist(['1.1.1.1'])}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('--remove of a missing ip is a usage error', async () => {
        const r = await runCli(
            ['ssh', 'allowlist', 'klant-x', '--remove', '9.9.9.9', '--json'],
            {routes: {...sites, ...allowlist(['1.1.1.1'])}},
        );
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(posts(r.calls)).toHaveLength(0);
    });
});

describe('ssh password', () => {
    test('get prints only the password', async () => {
        const r = await runCli(['ssh', 'password', 'get', 'klant-x'], {
            routes: {
                ...sites,
                'GET /sites/environments/env-live/ssh/password': {
                    body: {
                        environment: {id: 'env-live', sftp_password: 's3cret'},
                    },
                },
            },
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toBe('s3cret\n');
    });

    test('generate reports the follow-up command', async () => {
        const r = await runCli(['ssh', 'password', 'generate', 'klant-x'], {
            routes: {
                ...sites,
                'POST /sites/environments/env-live/ssh/generate-password': {
                    body: {result: null},
                },
            },
        });
        expect(r.code).toBe(0);
        expect(r.stdout).toContain(
            'New SFTP password generated; show it with: kinstactl ssh password get klant-x',
        );
    });

    test('enable and disable send is_enabled', async () => {
        const routes = {
            ...sites,
            'POST /sites/environments/env-live/ssh/set-password-status': {
                body: {result: null},
            },
        };
        const on = await runCli(['ssh', 'password', 'enable', 'klant-x'], {
            routes,
        });
        expect(posts(on.calls)[0]?.body).toEqual({is_enabled: true});
        const off = await runCli(['ssh', 'password', 'disable', 'klant-x'], {
            routes,
        });
        expect(posts(off.calls)[0]?.body).toEqual({is_enabled: false});
    });

    test('expiration maps 7d to days_7', async () => {
        const r = await runCli(
            ['ssh', 'password', 'expiration', 'klant-x', '7d'],
            {
                routes: {
                    ...sites,
                    'POST /sites/environments/env-live/ssh/change-expiration-interval':
                        {body: {result: null}},
                },
            },
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)[0]?.body).toEqual({exp_interval: 'days_7'});
    });

    test('expiration rejects an unknown interval', async () => {
        const r = await runCli(
            ['ssh', 'password', 'expiration', 'klant-x', '5d'],
            {routes: sites},
        );
        expect(r.code).toBe(2);
        expect(posts(r.calls)).toHaveLength(0);
    });
});
