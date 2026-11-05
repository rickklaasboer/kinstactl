import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, test} from 'bun:test';
import {createContainer} from '@/cli/container';
import {CliError} from '@/cli/errors';
import type {Prompts} from '@/cli/prompts';
import {SiteResolver, suggest} from '@/cli/services/SiteResolver';
import {type FakeRoute, fakeKinsta} from '../../helpers/fakeKinsta';

const env = (id: string, name: string, display: string) => ({
    id,
    name,
    display_name: display,
});

export const sitesBody = {
    company: {
        sites: [
            {
                id: 'id-x',
                name: 'my-site',
                display_name: 'My Site',
                status: 'live',
                environments: [
                    env('env-x-live', 'live', 'Live'),
                    env('env-x-staging', 'staging', 'Staging'),
                ],
            },
            {
                id: 'id-xyz',
                name: 'my-site-xyz',
                display_name: 'My Site XYZ',
                status: 'live',
                environments: [env('env-xyz-live', 'live', 'Live')],
            },
        ],
    },
};

function setup(
    opts: {interactive?: boolean; prompts?: Partial<Prompts>} = {},
    routes: Record<string, FakeRoute | FakeRoute[]> = {
        'GET /sites': {body: sitesBody},
    },
) {
    const dir = mkdtempSync(join(tmpdir(), 'kinstactl-resolve-'));
    const fake = fakeKinsta(routes);
    let out = '';
    let err = '';
    const prompts = {
        select: async () => {
            throw new Error('unexpected select');
        },
        search: async () => {
            throw new Error('unexpected search');
        },
        confirm: async () => {
            throw new Error('unexpected confirm');
        },
        text: async () => {
            throw new Error('unexpected text');
        },
        ...opts.prompts,
    } as Prompts;
    const resolver = createContainer({
        stdout: (s) => {
            out += s;
        },
        stderr: (s) => {
            err += s;
        },
        isTTY: opts.interactive ?? false,
        env: {
            KINSTA_API_KEY: 'k',
            KINSTA_COMPANY_ID: 'c1',
            NO_COLOR: '1',
            HOME: dir,
            XDG_CACHE_HOME: join(dir, 'cache'),
        },
        fetchFn: fake.fetch,
        progressOutput: process.stderr,
        prompts,
    }).resolve(SiteResolver);
    return {resolver, calls: fake.calls, stderr: () => err, stdout: () => out};
}

async function failure(p: Promise<unknown>): Promise<CliError> {
    try {
        await p;
    } catch (e) {
        expect(e).toBeInstanceOf(CliError);
        return e as CliError;
    }
    throw new Error('expected a CliError');
}

describe('resolveSite', () => {
    test.each(['MY-SITE', 'My Site', 'id-x'])(
        'matches %s case-insensitively on name, display name and id',
        async (input) => {
            const {resolver} = setup();
            expect(
                (await resolver.resolveSite(input, {fresh: false})).name,
            ).toBe('my-site');
        },
    );

    test('an exact match wins over a longer prefix match', async () => {
        const {resolver} = setup();
        expect((await resolver.resolveSite('my-site', {fresh: false})).id).toBe(
            'id-x',
        );
    });

    test('a unique prefix resolves', async () => {
        const {resolver} = setup();
        expect(
            (await resolver.resolveSite('my-site-xy', {fresh: false})).id,
        ).toBe('id-xyz');
    });

    test('an ambiguous prefix lists the candidates', async () => {
        const {resolver} = setup();
        const e = await failure(resolver.resolveSite('my', {fresh: false}));
        expect(e.code).toBe('SITE_AMBIGUOUS');
        expect(e.hints).toEqual(['my-site', 'my-site-xyz']);
    });

    test('an unknown site suggests close names', async () => {
        const {resolver} = setup();
        const e = await failure(
            resolver.resolveSite('my-stie', {fresh: false}),
        );
        expect(e.code).toBe('SITE_NOT_FOUND');
        expect(e.hints[0]).toBe('my-site');
    });

    test('a missing site non-interactively is a usage error without prompting', async () => {
        const {resolver, calls} = setup();
        const e = await failure(
            resolver.resolveSite(undefined, {fresh: false}),
        );
        expect(e.code).toBe('USAGE');
        expect(e.message).toBe('Missing <site>');
        expect(calls).toHaveLength(0);
    });

    test('a missing site interactively uses the search prompt', async () => {
        let labels: string[] = [];
        const {resolver} = setup({
            interactive: true,
            prompts: {
                search: (async (
                    _m: string,
                    options: Array<{value: unknown; label: string}>,
                ) => {
                    labels = options.map((o) => o.label);
                    return options[1]!.value;
                }) as Prompts['search'],
            },
        });
        const site = await resolver.resolveSite(undefined, {fresh: false});
        expect(site.name).toBe('my-site-xyz');
        expect(labels).toEqual([
            'My Site (my-site)',
            'My Site XYZ (my-site-xyz)',
        ]);
    });
});

describe('resolveEnv', () => {
    async function sites() {
        const {resolver, ...rest} = setup();
        const a = await resolver.resolveSite('my-site', {fresh: false});
        const b = await resolver.resolveSite('my-site-xyz', {fresh: false});
        return {resolver, a, b, ...rest};
    }

    test('several envs non-interactively require --env and never prompt', async () => {
        const {resolver, a} = await sites();
        const e = await failure(resolver.resolveEnv(a, undefined));
        expect(e.code).toBe('ENV_REQUIRED');
        expect(e.hints).toEqual(['--env live', '--env staging']);
    });

    test('a single env is used with an info message', async () => {
        const {resolver, b, stderr} = await sites();
        const e = await resolver.resolveEnv(b, undefined);
        expect(e.name).toBe('live');
        expect(e.isLive).toBe(true);
        expect(stderr()).toContain('Using environment live');
    });

    test('interactive selection offers live first', async () => {
        let labels: string[] = [];
        const {resolver} = setup({
            interactive: true,
            prompts: {
                select: (async (
                    _m: string,
                    options: Array<{value: unknown; label: string}>,
                ) => {
                    labels = options.map((o) => o.label);
                    return options[0]!.value;
                }) as Prompts['select'],
            },
        });
        const site = await resolver.resolveSite('my-site', {fresh: false});
        // staging first in the source order to prove sorting
        site.environments.reverse();
        const picked = await resolver.resolveEnv(site, undefined);
        expect(labels).toEqual(['Live', 'Staging']);
        expect(picked.name).toBe('live');
    });

    test('matches by name and display name', async () => {
        const {resolver, a} = await sites();
        expect((await resolver.resolveEnv(a, 'STAGING')).id).toBe(
            'env-x-staging',
        );
        expect((await resolver.resolveEnv(a, 'env-x-live')).name).toBe('live');
    });

    test('an unknown env is ENV_NOT_FOUND with suggestions', async () => {
        const {resolver, a} = await sites();
        const e = await failure(resolver.resolveEnv(a, 'stagnig'));
        expect(e.code).toBe('ENV_NOT_FOUND');
        expect(e.hints[0]).toBe('staging');
    });
});

describe('resolveTarget', () => {
    test('read targets use the cache, write targets always hit the API', async () => {
        const {resolver, calls} = setup();
        await resolver.resolveTarget('my-site', 'live', {write: false});
        await resolver.resolveTarget('my-site', 'live', {write: false});
        expect(calls).toHaveLength(1);
        const t = await resolver.resolveTarget('my-site', 'staging', {
            write: true,
        });
        expect(calls).toHaveLength(2);
        expect(t.env.id).toBe('env-x-staging');
        await resolver.resolveTarget('my-site', 'live', {write: true});
        expect(calls).toHaveLength(3);
    });
});

describe('details', () => {
    const routes = (envs: unknown[]) => ({
        'GET /sites': {body: sitesBody},
        'GET /sites/id-x/environments': {body: {site: {environments: envs}}},
    });

    test('returns the api environment of the target', async () => {
        const {resolver, calls} = setup(
            {},
            routes([
                {id: 'env-x-staging', cdn_cache_id: null},
                {id: 'env-x-live', cdn_cache_id: 'cdn1'},
            ]),
        );
        const target = await resolver.resolveTarget('my-site', 'live', {
            write: false,
        });
        const env = await resolver.details(target);
        expect(env.cdn_cache_id).toBe('cdn1');
        expect(calls.at(-1)!.url.pathname).toBe('/v2/sites/id-x/environments');
    });

    test('throws when the environment is missing from the response', async () => {
        const {resolver} = setup(
            {},
            routes([{id: 'env-x-staging', cdn_cache_id: null}]),
        );
        const target = await resolver.resolveTarget('my-site', 'live', {
            write: false,
        });
        await expect(resolver.details(target)).rejects.toThrow(
            'Environment env-x-live missing from the environments of my-site',
        );
    });
});

describe('suggest', () => {
    test('orders by distance, is case-insensitive and honors max', () => {
        expect(suggest('MY-STIE', ['my-site-x', 'my-site', 'other'])).toEqual([
            'my-site',
            'my-site-x',
        ]);
        expect(suggest('a', ['a1', 'a2', 'a3', 'a4'], 2)).toHaveLength(2);
    });
});
