import {describe, expect, test} from 'bun:test';
import {createContainer} from '@/cli/container';
import {toCliError} from '@/cli/errors';
import type {Io} from '@/cli/io';
import {Output} from '@/cli/output';
import {
    type ConfirmSpec,
    OperationRunner,
} from '@/cli/services/OperationRunner';
import {RunContext} from '@/cli/services/RunContext';
import type {RequestSpec} from '@/client/request';
import {type FakeRoute, fakeKinsta} from '../../helpers/fakeKinsta';

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
        confirm?: ConfirmSpec;
        spec?: RequestSpec;
        redact?: (body: unknown) => unknown;
        via?: 'run' | 'send';
        target?: false;
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
        progressOutput: process.stderr,
        prompts: {} as Io['prompts'],
    };
    const c = createContainer(io);
    c.resolve(RunContext).json = opts.json === true;
    let code = 0;
    let result: unknown;
    try {
        result = await c.resolve(OperationRunner)[opts.via ?? 'run']({
            title: 'Clear cache',
            spec: opts.spec ?? spec,
            target: opts.target === false ? undefined : {site, env},
            flags: {...flags, ...f},
            confirm: opts.confirm,
            redact: opts.redact,
        });
    } catch (e) {
        const err = toCliError(e);
        c.resolve(Output).error(err);
        code = err.exitCode;
    }
    return {code, stdout, stderr, calls: fake.calls, result};
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

describe('runOperation redact', () => {
    const secretSpec: RequestSpec = {...spec, body: {password: 'secret'}};
    const redact = (b: unknown) => ({...(b as object), password: '***'});

    test('dry-run shows the redacted body', async () => {
        const json = await exec(
            {},
            {dryRun: true},
            {json: true, spec: secretSpec, redact},
        );
        expect(JSON.parse(json.stdout).request.body.password).toBe('***');
        const human = await exec(
            {},
            {dryRun: true},
            {spec: secretSpec, redact},
        );
        expect(human.stdout).toContain('"password":"***"');
        expect(human.stdout).not.toContain('secret');
    });

    test('dry-run leaves a request without body unredacted', async () => {
        const getSpec: RequestSpec = {
            endpoint: 'GET /sites',
            method: 'GET',
            path: '/sites',
        };
        const r = await exec(
            {},
            {dryRun: true},
            {json: true, spec: getSpec, redact},
        );
        expect(JSON.parse(r.stdout).request).not.toHaveProperty('body');
    });

    test('redact does not touch the sent body', async () => {
        const r = await exec(
            started,
            {wait: false},
            {json: true, spec: secretSpec, redact},
        );
        expect(r.code).toBe(0);
        expect(r.calls[0]!.method).toBe('POST');
        expect((r.calls[0]!.body as {password: string}).password).toBe(
            'secret',
        );
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

    test('a confirm with where needs no target', async () => {
        const r = await exec(
            done,
            {yes: true},
            {
                json: true,
                target: false,
                confirm: {...confirm, where: 'zone example.com'},
            },
        );
        expect(r.code).toBe(0);
        expect(r.calls[0]!.method).toBe('POST');
    });

    test('a confirm without target and without where is a programming error', async () => {
        const r = await exec(done, {yes: true}, {target: false, confirm});
        expect(r.calls).toEqual([]);
        expect(r.stderr).toContain('confirm requires a target or where');
    });
});

describe('runOperation result', () => {
    test('run resolves with the operation result', async () => {
        const r = await exec(
            {
                ...started,
                'GET /operations/op1': {
                    status: 200,
                    body: {message: 'ok', status: 200},
                },
            },
            {},
            {json: true},
        );
        expect(r.result).toEqual({
            message: 'ok',
            data: undefined,
            operationId: 'op1',
        });
    });

    test('run resolves with undefined after a dry run and with --no-wait', async () => {
        expect((await exec({}, {dryRun: true})).result).toBeUndefined();
        expect((await exec(started, {wait: false})).result).toBeUndefined();
    });
});

describe('send', () => {
    const put: RequestSpec = {
        endpoint: 'PUT /sites/tools/modify-php-version',
        method: 'PUT',
        path: '/zones/z1',
        body: {a: 1},
    };
    const where = {
        action: 'Overwrite zone',
        level: 'confirm' as const,
        where: 'zone example.com',
    };
    const sync = {'PUT /zones/z1': {body: {result: null}}};
    const operation = {
        'PUT /zones/z1': {body: {operation_id: 'op9', message: 'started'}},
        'GET /operations/op9': {
            status: 200,
            body: {message: 'ok', status: 200},
        },
    };
    const polled = (r: {calls: {url: URL}[]}) =>
        r.calls.filter((c) => c.url.pathname.includes('/operations')).length;

    test('sends a sync request after dry-run and confirmation and returns the body', async () => {
        const r = await exec(
            sync,
            {yes: true},
            {via: 'send', spec: put, target: false, confirm: where},
        );
        expect(r.code).toBe(0);
        expect(r.result).toEqual({result: null});
        expect(r.calls.map((c) => c.method)).toEqual(['PUT']);
        expect(r.stdout).toBe('');
    });

    test('--dry-run sends nothing and resolves undefined', async () => {
        const r = await exec(
            sync,
            {dryRun: true},
            {via: 'send', spec: put, confirm: where},
        );
        expect(r.code).toBe(0);
        expect(r.result).toBeUndefined();
        expect(r.calls).toEqual([]);
        expect(r.stdout).toContain('Dry run');
    });

    test('without --yes and without a TTY exits 5 and sends nothing', async () => {
        const r = await exec(
            sync,
            {},
            {
                via: 'send',
                spec: put,
                target: false,
                confirm: where,
                json: true,
            },
        );
        expect(r.code).toBe(5);
        const error = JSON.parse(r.stderr).error;
        expect(error.code).toBe('CONFIRMATION_REQUIRED');
        expect(error.message).toContain('zone example.com');
        expect(r.calls).toEqual([]);
    });

    test('waits when the body carries an operation_id', async () => {
        const waited = await exec(operation, {}, {via: 'send', spec: put});
        expect(waited.code).toBe(0);
        expect(polled(waited)).toBe(1);
        expect(waited.result).toEqual({
            operation_id: 'op9',
            message: 'started',
        });
        const unwaited = await exec(
            operation,
            {wait: false},
            {via: 'send', spec: put},
        );
        expect(polled(unwaited)).toBe(0);
    });
});
