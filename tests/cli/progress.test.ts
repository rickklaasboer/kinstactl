import {describe, expect, test} from 'bun:test';
import {createContainer} from '@/cli/container';
import {toCliError} from '@/cli/errors';
import {runOperation} from '@/cli/progress';
import type {Io} from '@/cli/io';
import {Runtime} from '@/cli/runtime';
import type {RequestSpec} from '@/client/request';
import {type FakeRoute, fakeKinsta} from '../helpers/fakeKinsta';

const site = {
    id: 's1',
    name: 'klant-x',
    displayName: 'Klant X',
    environments: [],
};
const env = {id: 'e1', name: 'live', displayName: 'Live', isLive: true};
const spec: RequestSpec = {
    endpoint: 'POST /sites/tools/clear-cache',
    method: 'POST',
    path: '/sites/tools/clear-cache',
    body: {environment_id: 'e1'},
};
const flags = {wait: true, dryRun: false, yes: false};

async function exec(
    routes: Record<string, FakeRoute | FakeRoute[]>,
    f: Partial<typeof flags> & {timeout?: number},
    opts: {
        json?: boolean;
        confirm?: {action: string; level: 'confirm' | 'irreversible'};
    } = {},
) {
    const fake = fakeKinsta(routes);
    let clock = 0;
    let stdout = '';
    let stderr = '';
    const io: Io = {
        stdout: (s) => {
            stdout += s;
        },
        stderr: (s) => {
            stderr += s;
        },
        isTTY: false,
        env: {KINSTA_API_KEY: 'k', KINSTA_COMPANY_ID: 'c1', NO_COLOR: '1'},
        fetchFn: fake.fetch,
        sleep: async () => {},
        // Each reading is a minute later, so the wait deadline passes without real time.
        now: () => {
            clock += 60_000;
            return clock;
        },
        prompts: {} as Io['prompts'],
    };
    const rt = createContainer(io).resolve(Runtime);
    rt.json = opts.json === true;
    let code = 0;
    try {
        await runOperation(rt, {
            title: 'Clear cache',
            spec,
            target: {site, env},
            flags: {...flags, ...f},
            confirm: opts.confirm,
        });
    } catch (e) {
        const err = toCliError(e);
        rt.output.error(err);
        code = err.exitCode;
    }
    return {code, stdout, stderr, calls: fake.calls};
}

const started = {
    'POST /sites/tools/clear-cache': {
        body: {operation_id: 'op1', message: 'Clearing'},
    },
};

describe('runOperation', () => {
    test('dry-run makes no HTTP call and prints the request', async () => {
        const r = await exec({}, {dryRun: true}, {json: true});
        expect(r.code).toBe(0);
        expect(r.calls).toEqual([]);
        const out = JSON.parse(r.stdout);
        expect(out.dry_run).toBe(true);
        expect(out.target.site.name).toBe('klant-x');
        expect(out.request.method).toBe('POST');
        expect(out.request.body.environment_id).toBe('e1');
    });

    test('dry-run human summary names the target and request', async () => {
        const r = await exec({}, {dryRun: true});
        expect(r.stdout).toContain('Dry run');
        expect(r.stdout).toContain('POST /sites/tools/clear-cache');
        expect(r.calls).toEqual([]);
    });

    test('--no-wait returns the operation id without polling', async () => {
        const r = await exec(started, {wait: false}, {json: true});
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual({
            operation_id: 'op1',
            status: 'pending',
        });
        expect(
            r.calls.some((c) => c.url.pathname.includes('/operations')),
        ).toBe(false);
    });

    test('--no-wait human output points to operations wait', async () => {
        const r = await exec(started, {wait: false});
        expect(r.stdout).toContain('Started Clear cache');
        expect(r.stderr).toContain('kinstactl operations wait op1');
    });

    test('polls until the operation completes', async () => {
        const r = await exec(
            {
                ...started,
                'GET /operations/op1': [{status: 202}, {status: 200}],
            },
            {},
            {json: true},
        );
        expect(r.code).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual({
            operation_id: 'op1',
            status: 'completed',
        });
    });

    test('a failed operation exits 3 with the Kinsta message', async () => {
        const routes = {
            ...started,
            'GET /operations/op1': {
                status: 500,
                body: {message: 'Cache clear failed'},
            },
        };
        const human = await exec(routes, {});
        expect(human.code).toBe(3);
        expect(human.stderr).toContain('Cache clear failed');
        const json = await exec(routes, {}, {json: true});
        expect(json.code).toBe(3);
        expect(JSON.parse(json.stderr).error.code).toBe('OPERATION_FAILED');
    });

    test('a timeout exits 4', async () => {
        const r = await exec(
            {...started, 'GET /operations/op1': {status: 202}},
            {timeout: 1},
            {json: true},
        );
        expect(r.code).toBe(4);
        expect(JSON.parse(r.stderr).error.code).toBe('OPERATION_TIMEOUT');
    });
});

describe('runOperation confirm ordering', () => {
    const done = {
        ...started,
        'GET /operations/op1': {status: 200},
    };
    const confirm = {action: 'Clear cache', level: 'confirm' as const};
    const irreversible = {
        action: 'Delete site',
        level: 'irreversible' as const,
    };

    test('dry-run returns before confirming, without --yes', async () => {
        const r = await exec({}, {dryRun: true}, {json: true, confirm});
        expect(r.code).toBe(0);
        expect(r.calls).toEqual([]);
    });

    test('unconfirmed destructive operation sends nothing', async () => {
        const r = await exec(done, {}, {json: true, confirm});
        expect(r.code).toBe(5);
        expect(JSON.parse(r.stderr).error.code).toBe('CONFIRMATION_REQUIRED');
        expect(r.calls).toEqual([]);
    });

    test('--yes lets the request through', async () => {
        const r = await exec(done, {yes: true}, {json: true, confirm});
        expect(r.code).toBe(0);
        expect(r.calls[0]!.method).toBe('POST');
    });

    test('irreversible with only --yes sends nothing', async () => {
        const r = await exec(
            done,
            {yes: true},
            {json: true, confirm: irreversible},
        );
        expect(r.code).toBe(5);
        expect(r.calls).toEqual([]);
    });
});
