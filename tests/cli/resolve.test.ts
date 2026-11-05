import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, test} from 'bun:test';
import {CliError} from '@/cli/errors';
import type {Prompts} from '@/cli/prompts';
import {resolveEnv, resolveSite, resolveTarget, suggest} from '@/cli/resolve';
import {Runtime} from '@/cli/runtime';
import {type FakeRoute, fakeKinsta} from '../helpers/fakeKinsta';

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
                name: 'klant-x',
                display_name: 'Klant X',
                status: 'live',
                environments: [
                    env('env-x-live', 'live', 'Live'),
                    env('env-x-staging', 'staging', 'Staging'),
                ],
            },
            {
                id: 'id-xyz',
                name: 'klant-xyz',
                display_name: 'Klant XYZ',
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
    const rt = new Runtime({
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
        prompts,
    });
    return {rt, calls: fake.calls, stderr: () => err, stdout: () => out};
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
    test.each(['KLANT-X', 'Klant X', 'id-x'])(
        'matches %s case-insensitively on name, display name and id',
        async (input) => {
            const {rt} = setup();
            expect((await resolveSite(rt, input, {fresh: false})).name).toBe(
                'klant-x',
            );
        },
    );

    test('an exact match wins over a longer prefix match', async () => {
        const {rt} = setup();
        expect((await resolveSite(rt, 'klant-x', {fresh: false})).id).toBe(
            'id-x',
        );
    });

    test('a unique prefix resolves', async () => {
        const {rt} = setup();
        expect((await resolveSite(rt, 'klant-xy', {fresh: false})).id).toBe(
            'id-xyz',
        );
    });

    test('an ambiguous prefix lists the candidates', async () => {
        const {rt} = setup();
        const e = await failure(resolveSite(rt, 'klant', {fresh: false}));
        expect(e.code).toBe('SITE_AMBIGUOUS');
        expect(e.hints).toEqual(['klant-x', 'klant-xyz']);
    });

    test('an unknown site suggests close names', async () => {
        const {rt} = setup();
        const e = await failure(resolveSite(rt, 'klnat-x', {fresh: false}));
        expect(e.code).toBe('SITE_NOT_FOUND');
        expect(e.hints[0]).toBe('klant-x');
    });

    test('a missing site non-interactively is a usage error without prompting', async () => {
        const {rt, calls} = setup();
        const e = await failure(resolveSite(rt, undefined, {fresh: false}));
        expect(e.code).toBe('USAGE');
        expect(e.message).toBe('Missing <site>');
        expect(calls).toHaveLength(0);
    });

    test('a missing site interactively uses the search prompt', async () => {
        let labels: string[] = [];
        const {rt} = setup({
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
        const site = await resolveSite(rt, undefined, {fresh: false});
        expect(site.name).toBe('klant-xyz');
        expect(labels).toEqual(['Klant X (klant-x)', 'Klant XYZ (klant-xyz)']);
    });
});

describe('resolveEnv', () => {
    async function sites() {
        const {rt, ...rest} = setup();
        const a = await resolveSite(rt, 'klant-x', {fresh: false});
        const b = await resolveSite(rt, 'klant-xyz', {fresh: false});
        return {rt, a, b, ...rest};
    }

    test('several envs non-interactively require --env and never prompt', async () => {
        const {rt, a} = await sites();
        const e = await failure(resolveEnv(rt, a, undefined));
        expect(e.code).toBe('ENV_REQUIRED');
        expect(e.hints).toEqual(['--env live', '--env staging']);
    });

    test('a single env is used with an info message', async () => {
        const {rt, b, stderr} = await sites();
        const e = await resolveEnv(rt, b, undefined);
        expect(e.name).toBe('live');
        expect(e.isLive).toBe(true);
        expect(stderr()).toContain('Using environment live');
    });

    test('interactive selection offers live first', async () => {
        let labels: string[] = [];
        const {rt} = setup({
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
        const site = await resolveSite(rt, 'klant-x', {fresh: false});
        // staging first in the source order to prove sorting
        site.environments.reverse();
        const picked = await resolveEnv(rt, site, undefined);
        expect(labels).toEqual(['Live', 'Staging']);
        expect(picked.name).toBe('live');
    });

    test('matches by name and display name', async () => {
        const {rt, a} = await sites();
        expect((await resolveEnv(rt, a, 'STAGING')).id).toBe('env-x-staging');
        expect((await resolveEnv(rt, a, 'env-x-live')).name).toBe('live');
    });

    test('an unknown env is ENV_NOT_FOUND with suggestions', async () => {
        const {rt, a} = await sites();
        const e = await failure(resolveEnv(rt, a, 'stagnig'));
        expect(e.code).toBe('ENV_NOT_FOUND');
        expect(e.hints[0]).toBe('staging');
    });
});

describe('resolveTarget', () => {
    test('read targets use the cache, write targets always hit the API', async () => {
        const {rt, calls} = setup();
        await resolveTarget(rt, 'klant-x', 'live', {write: false});
        await resolveTarget(rt, 'klant-x', 'live', {write: false});
        expect(calls).toHaveLength(1);
        const t = await resolveTarget(rt, 'klant-x', 'staging', {write: true});
        expect(calls).toHaveLength(2);
        expect(t.env.id).toBe('env-x-staging');
        await resolveTarget(rt, 'klant-x', 'live', {write: true});
        expect(calls).toHaveLength(3);
    });
});

describe('suggest', () => {
    test('orders by distance, is case-insensitive and honors max', () => {
        expect(suggest('KLNAT-X', ['klant-xyz', 'klant-x', 'other'])).toEqual([
            'klant-x',
            'klant-xyz',
        ]);
        expect(suggest('a', ['a1', 'a2', 'a3', 'a4'], 2)).toHaveLength(2);
    });
});
