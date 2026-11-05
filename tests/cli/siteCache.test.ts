import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect, test} from 'bun:test';
import type {Prompts} from '@/cli/prompts';
import {Runtime} from '@/cli/runtime';
import {SITE_CACHE_TTL_MS, loadSites, siteCachePath} from '@/cli/siteCache';
import {fakeKinsta} from '../helpers/fakeKinsta';

const body = {
    company: {
        sites: [
            {
                id: 's1',
                name: 'one',
                display_name: 'One',
                status: 'live',
                environments: [
                    {id: 'e1', name: 'live', display_name: 'Live'},
                    {id: 'e2', name: 'staging', display_name: 'Staging'},
                ],
            },
        ],
    },
};

function setup() {
    const dir = mkdtempSync(join(tmpdir(), 'kinstactl-cache-'));
    const fake = fakeKinsta({'GET /sites': {body}});
    let err = '';
    let clock = 1_000_000;
    const env = {
        KINSTA_API_KEY: 'k',
        KINSTA_COMPANY_ID: 'c1',
        NO_COLOR: '1',
        HOME: dir,
        XDG_CACHE_HOME: join(dir, 'cache'),
    };
    const rt = new Runtime({
        stdout: () => {},
        stderr: (s) => {
            err += s;
        },
        isTTY: false,
        env,
        fetchFn: fake.fetch,
        now: () => clock,
        prompts: {} as Prompts,
    });
    return {
        rt,
        calls: fake.calls,
        stderr: () => err,
        path: siteCachePath(env, 'c1'),
        advance: (ms: number) => {
            clock += ms;
        },
    };
}

describe('loadSites', () => {
    test('maps the API response and writes the cache file', async () => {
        const {rt, path} = setup();
        const sites = await loadSites(rt, {fresh: false});
        expect(sites).toEqual([
            {
                id: 's1',
                name: 'one',
                displayName: 'One',
                environments: [
                    {id: 'e1', name: 'live', displayName: 'Live', isLive: true},
                    {
                        id: 'e2',
                        name: 'staging',
                        displayName: 'Staging',
                        isLive: false,
                    },
                ],
            },
        ]);
        expect(path.endsWith('/kinstactl/sites-c1.json')).toBe(true);
        expect(JSON.parse(readFileSync(path, 'utf8')).sites).toEqual(sites);
    });

    test('a second call within the TTL makes no request', async () => {
        const {rt, calls, advance} = setup();
        await loadSites(rt, {fresh: false});
        advance(SITE_CACHE_TTL_MS - 1);
        await loadSites(rt, {fresh: false});
        expect(calls).toHaveLength(1);
    });

    test('an expired cache is refetched', async () => {
        const {rt, calls, advance} = setup();
        await loadSites(rt, {fresh: false});
        advance(SITE_CACHE_TTL_MS);
        await loadSites(rt, {fresh: false});
        expect(calls).toHaveLength(2);
    });

    test('fresh bypasses the cache and rewrites it', async () => {
        const {rt, calls, advance, path} = setup();
        await loadSites(rt, {fresh: false});
        advance(1000);
        await loadSites(rt, {fresh: true});
        expect(calls).toHaveLength(2);
        expect(JSON.parse(readFileSync(path, 'utf8')).fetchedAt).toBe(
            1_001_000,
        );
    });

    test.each([
        ['invalid JSON', '{nope'],
        [
            'a wrong shape',
            JSON.stringify({fetchedAt: 1_000_000, sites: [{id: 1}]}),
        ],
    ])(
        'a corrupt cache (%s) is reported and refetched',
        async (_n, content) => {
            const {rt, calls, path, stderr} = setup();
            mkdirSync(join(path, '..'), {recursive: true});
            writeFileSync(path, content);
            const sites = await loadSites(rt, {fresh: false});
            expect(sites).toHaveLength(1);
            expect(calls).toHaveLength(1);
            expect(stderr()).toContain('Ignoring corrupt site cache');
            expect(JSON.parse(readFileSync(path, 'utf8')).sites).toEqual(sites);
        },
    );
});
