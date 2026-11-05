import {describe, expect, test} from 'bun:test';
import {loadConfig} from '@/cli/config';
import {runCli} from '../../helpers/runCli';

const validate = {
    name: 'cli',
    company: 'c9',
    status: 'active',
    expires_at: null,
};

describe('auth login', () => {
    test('non-interactive login stores the profile with company and key name', async () => {
        const r = await runCli(
            ['auth', 'login', '--api-key', 'k', '--profile', 'work'],
            {
                routes: {'GET /validate': {body: validate}},
            },
        );
        expect(r.code).toBe(0);
        expect(r.calls[0]!.headers.get('Authorization')).toBe('Bearer k');
        expect(loadConfig(r.env).profiles.work).toEqual({
            apiKey: 'k',
            companyId: 'c9',
            keyName: 'cli',
        });
        expect(loadConfig(r.env).defaultProfile).toBe('work');
    });

    test('--api-key - reads the key from stdin', async () => {
        const r = await runCli(['auth', 'login', '--api-key', '-'], {
            io: {stdin: async () => 'k\n'},
            routes: {'GET /validate': {body: validate}},
        });
        expect(r.code).toBe(0);
        expect(r.calls[0]!.headers.get('Authorization')).toBe('Bearer k');
        expect(loadConfig(r.env).profiles.default?.apiKey).toBe('k');
    });

    test('--api-key - with empty stdin is a usage error', async () => {
        const r = await runCli(['auth', 'login', '--api-key', '-', '--json'], {
            io: {stdin: async () => '\n'},
        });
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(r.calls).toEqual([]);
    });

    test('non-interactive login without --api-key is a usage error', async () => {
        const r = await runCli(['auth', 'login', '--json']);
        expect(r.code).toBe(2);
        expect(JSON.parse(r.stderr).error.code).toBe('USAGE');
        expect(r.stdout).toBe('');
    });

    const noPrompt: Array<[string, string[], Record<string, string>]> = [
        ['--no-input', ['--no-input'], {}],
        ['KINSTACTL_NO_INPUT=1', [], {KINSTACTL_NO_INPUT: '1'}],
        ['CI=true', [], {CI: 'true'}],
        ['--json', ['--json'], {}],
    ];
    for (const [name, flags, env] of noPrompt) {
        test(`login on a TTY with ${name} never prompts`, async () => {
            const r = await runCli(['auth', 'login', ...flags], {
                tty: true,
                env,
            });
            expect(r.code).toBe(2);
            expect(r.stderr).toContain('No API key given');
        });
    }

    test('login honors KINSTA_PROFILE', async () => {
        const r = await runCli(['auth', 'login', '--api-key', 'k'], {
            env: {KINSTA_PROFILE: 'work'},
            routes: {'GET /validate': {body: validate}},
        });
        expect(Object.keys(loadConfig(r.env).profiles)).toEqual(['work']);
    });

    test('interactive login prompts for the key as a secret', async () => {
        let secret: boolean | undefined;
        const r = await runCli(['auth', 'login'], {
            tty: true,
            routes: {'GET /validate': {body: validate}},
            prompts: {
                text: async (_m, o) => {
                    secret = o?.secret;
                    return 'typed-key';
                },
            },
        });
        expect(r.code).toBe(0);
        expect(secret).toBe(true);
        expect(loadConfig(r.env).profiles.default!.apiKey).toBe('typed-key');
    });

    test('a rejected key exits 1 and stores nothing', async () => {
        const r = await runCli(['auth', 'login', '--api-key', 'bad'], {
            routes: {
                'GET /validate': {status: 401, body: {message: 'Unauthorized'}},
            },
        });
        expect(r.code).toBe(1);
        expect(loadConfig(r.env).profiles).toEqual({});
    });
});

describe('auth status', () => {
    test('reports profile, company, key name and expiry as JSON', async () => {
        const r = await runCli(['auth', 'status', '--json'], {
            routes: {
                'GET /validate': {
                    body: {...validate, expires_at: '2027-01-01'},
                },
            },
        });
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual({
            source: 'env',
            profile: null,
            companyId: 'c1',
            keyName: 'cli',
            status: 'active',
            expiresAt: '2027-01-01',
        });
    });

    test('a 401 exits 1 and points at auth login', async () => {
        const r = await runCli(['auth', 'status'], {
            routes: {
                'GET /validate': {status: 401, body: {message: 'Unauthorized'}},
            },
        });
        expect(r.code).toBe(1);
        expect(r.stderr).toContain('kinstactl auth login');
    });

    test('missing credentials exit 2', async () => {
        const r = await runCli(['auth', 'status'], {
            env: {KINSTA_API_KEY: undefined, KINSTA_COMPANY_ID: undefined},
        });
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('kinstactl auth login');
    });
});

describe('auth logout and profiles', () => {
    const config = {
        defaultProfile: 'work',
        profiles: {
            work: {apiKey: 'a', companyId: 'c1', keyName: 'cli'},
            other: {apiKey: 'b', companyId: 'c2'},
        },
    };

    test('profiles with no config is an empty list', async () => {
        const r = await runCli(['auth', 'profiles', '--json']);
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual([]);
    });

    test('profiles marks the default in the table', async () => {
        const r = await runCli(['auth', 'profiles'], {config});
        expect(r.stdout).toMatch(/work\s+c1\s+cli\s+\*/);
        expect(r.stdout).toMatch(/other\s+c2/);
    });

    test('logout removes the profile and clears the default when it pointed there', async () => {
        const r = await runCli(['auth', 'logout', '--profile', 'work'], {
            config,
        });
        expect(r.code).toBe(0);
        const cfg = loadConfig(r.env);
        expect(Object.keys(cfg.profiles)).toEqual(['other']);
        expect(cfg.defaultProfile).toBeUndefined();
    });

    test('logout honors KINSTA_PROFILE', async () => {
        const r = await runCli(['auth', 'logout'], {
            config,
            env: {KINSTA_PROFILE: 'other'},
        });
        expect(r.code).toBe(0);
        expect(Object.keys(loadConfig(r.env).profiles)).toEqual(['work']);
    });

    test('logout of an unknown profile is a usage error', async () => {
        const r = await runCli(['auth', 'logout', '--profile', 'nope']);
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('nope');
    });
});
