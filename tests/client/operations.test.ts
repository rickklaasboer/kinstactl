import {describe, expect, it, test} from 'bun:test';
import {HttpTransport} from '@/client/transport';
import {
    KinstaApiError,
    OperationFailedError,
    OperationTimeoutError,
} from '@/client/errors';
import {
    Operation,
    operationFor,
    operationIdOf,
    startOperation,
} from '@/client/operations';
import type {RequestSpec} from '@/client/request';
import {fakeKinsta} from '../helpers/fakeKinsta';

function fakeTransport(
    statuses: Array<{status: number; body?: unknown} | {throw: Error}>,
) {
    let i = 0;
    const paths: string[] = [];
    const specs: RequestSpec[] = [];
    const transport = {
        raw: async (spec: RequestSpec) => {
            specs.push(spec);
            paths.push(spec.path);
            const r = statuses[Math.min(i++, statuses.length - 1)]!;
            if ('throw' in r) throw r.throw;
            return {
                status: r.status,
                body: r.body ?? {},
                headers: new Headers(),
            };
        },
    } as unknown as HttpTransport;
    return {transport, paths, specs};
}

const networkError = () =>
    new KinstaApiError(
        0,
        'Network error calling GET /operations/{operation_id}: ECONNRESET',
    );

function fakeTime() {
    let t = 0;
    return {
        now: () => t,
        sleep: async (ms: number) => {
            t += ms;
        },
        advanceTo: (ms: number) => {
            t = ms;
        },
    };
}

const base = (time: ReturnType<typeof fakeTime>) => ({
    timeoutMs: 15 * 60_000,
    now: time.now,
    sleep: time.sleep,
    random: () => 0.5, // jitter factor becomes exactly 1.0
});

describe('Operation.wait', () => {
    it('polls until 200 and polls the operations endpoint', async () => {
        const time = fakeTime();
        const {transport, paths, specs} = fakeTransport([
            {status: 202},
            {status: 202},
            {status: 200},
        ]);
        await operationFor(transport, 'op-1').wait(base(time));
        expect(paths).toEqual([
            '/operations/op-1',
            '/operations/op-1',
            '/operations/op-1',
        ]);
        expect(specs[0]!.endpoint).toBe('GET /operations/{operation_id}');
        expect(specs[0]!.method).toBe('GET');
        // first poll after 3s, then 5s, then 7.5s
        expect(time.now()).toBe(3_000 + 5_000 + 7_500);
    });

    it('reports pending and done through onPoll after each poll', async () => {
        const time = fakeTime();
        const {transport} = fakeTransport([{status: 202}, {status: 200}]);
        const seen: string[] = [];
        await operationFor(transport, 'op-1').wait({
            ...base(time),
            onPoll: (s) => seen.push(s),
        });
        expect(seen).toEqual(['pending', 'done']);
    });

    it('rejects with the API message on 500', async () => {
        const time = fakeTime();
        const {transport} = fakeTransport([
            {status: 500, body: {message: 'Updating WordPress plugin failed'}},
        ]);
        await expect(
            operationFor(transport, 'op-2').wait(base(time)),
        ).rejects.toThrow('Updating WordPress plugin failed');
    });

    test('failed operation error carries operationId and Kinsta message', async () => {
        const time = fakeTime();
        const {transport} = fakeTransport([
            {status: 500, body: {message: 'Backup failed'}},
        ]);
        let caught: unknown;
        try {
            await operationFor(transport, 'op-9').wait(base(time));
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(OperationFailedError);
        expect((caught as OperationFailedError).operationId).toBe('op-9');
        expect((caught as OperationFailedError).message).toBe('Backup failed');
    });

    it('tolerates 404 during the first 20s, then keeps polling', async () => {
        const time = fakeTime();
        const {transport, paths} = fakeTransport([
            {status: 404},
            {status: 202},
            {status: 200},
        ]);
        await operationFor(transport, 'op-3').wait(base(time));
        expect(paths.length).toBe(3);
    });

    it('fails on 404 after the 20s grace window', async () => {
        const time = fakeTime();
        const {transport} = fakeTransport([{status: 202}, {status: 404}]);
        const opts = {
            ...base(time),
            sleep: async (ms: number) =>
                time.advanceTo(Math.max(time.now() + ms, 25_000)),
        };
        await expect(
            operationFor(transport, 'op-4').wait(opts),
        ).rejects.toThrow(OperationFailedError);
    });

    it('times out with a server-side note', async () => {
        const time = fakeTime();
        const {transport} = fakeTransport([{status: 202}]);
        const opts = {...base(time), timeoutMs: 10_000};
        let caught: unknown;
        try {
            await operationFor(transport, 'op-5').wait(opts);
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(OperationTimeoutError);
        expect((caught as OperationTimeoutError).operationId).toBe('op-5');
        expect((caught as Error).message).toContain(
            'may still complete server-side',
        );
    });

    it('tolerates up to 3 consecutive transient network errors then resolves', async () => {
        const time = fakeTime();
        const {transport, paths} = fakeTransport([
            {throw: networkError()},
            {throw: networkError()},
            {status: 200},
        ]);
        await operationFor(transport, 'op-7').wait(base(time));
        expect(paths.length).toBe(3);
    });

    it('treats gateway statuses as transient too', async () => {
        const time = fakeTime();
        const {transport, paths} = fakeTransport([
            {status: 502},
            {status: 503},
            {status: 504},
            {status: 200},
        ]);
        await operationFor(transport, 'op-7').wait(base(time));
        expect(paths.length).toBe(4);
    });

    it('rejects with OperationTimeoutError after 4 consecutive network errors', async () => {
        const time = fakeTime();
        const {transport, paths} = fakeTransport([
            {throw: networkError()},
            {throw: networkError()},
            {throw: networkError()},
            {throw: networkError()},
        ]);
        let caught: unknown;
        try {
            await operationFor(transport, 'op-8').wait(base(time));
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(OperationTimeoutError);
        expect((caught as OperationTimeoutError).operationId).toBe('op-8');
        expect((caught as Error).message).toBe(
            'Lost contact with Kinsta while waiting for op-8 (Network error calling GET /operations/{operation_id}: ECONNRESET); the operation may still complete server-side',
        );
        expect(paths.length).toBe(4);
    });

    it('rethrows a non-network error on its first occurrence', async () => {
        const time = fakeTime();
        const boom = new TypeError('programming error');
        const {transport, paths} = fakeTransport([{throw: boom}]);
        let caught: unknown;
        try {
            await operationFor(transport, 'op-10').wait(base(time));
        } catch (e) {
            caught = e;
        }
        expect(caught).toBe(boom);
        expect(paths.length).toBe(1);
    });

    it('surfaces a 401 while polling as a KinstaApiError', async () => {
        const time = fakeTime();
        const {transport, paths} = fakeTransport([
            {status: 401, body: {message: 'Unauthorized'}},
        ]);
        let caught: unknown;
        try {
            await operationFor(transport, 'op-11').wait(base(time));
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(KinstaApiError);
        expect((caught as KinstaApiError).status).toBe(401);
        expect(paths.length).toBe(1);
    });

    it('caps the poll interval at 15s', async () => {
        const time = fakeTime();
        const statuses = Array.from({length: 19}, () => ({status: 202}));
        statuses.push({status: 200});
        const {transport} = fakeTransport(statuses);
        await operationFor(transport, 'op-6').wait({
            ...base(time),
            timeoutMs: 30 * 60_000,
        });
        // intervals: 3, 5, 7.5, 11.25, 15, 15, ... never above 15s (jitter factor 1.0)
        expect(time.now()).toBe(3_000 + 5_000 + 7_500 + 11_250 + 15_000 * 16);
    });
});

describe('operationIdOf', () => {
    it('extracts a non-empty operation_id', () => {
        expect(operationIdOf({operation_id: 'sites:add-x'})).toBe(
            'sites:add-x',
        );
    });
    it('returns null for empty, missing or non-object input', () => {
        expect(operationIdOf({operation_id: ''})).toBeNull();
        expect(operationIdOf({})).toBeNull();
        expect(operationIdOf(null)).toBeNull();
        expect(operationIdOf('x')).toBeNull();
    });
});

describe('startOperation', () => {
    const spec: RequestSpec = {
        endpoint: 'POST /sites/tools/clear-cache',
        method: 'POST',
        path: '/sites/tools/clear-cache',
        body: {},
    };

    test('startOperation accepts 200 with operation_id', async () => {
        const {fetch} = fakeKinsta({
            'POST /sites/tools/clear-cache': {
                status: 200,
                body: {
                    operation_id: 'bulk:update-1',
                    message: 'Updating',
                    status: 200,
                },
            },
        });
        const op = await startOperation(
            new HttpTransport({apiKey: 'k', fetchFn: fetch}),
            spec,
        );
        expect(op).toBeInstanceOf(Operation);
        expect(op.id).toBe('bulk:update-1');
        expect(op.message).toBe('Updating');
    });

    test('startOperation throws when body has no operation_id', async () => {
        const {fetch} = fakeKinsta({
            'POST /sites/tools/clear-cache': {
                status: 200,
                body: {message: 'ok'},
            },
        });
        const t = new HttpTransport({apiKey: 'k', fetchFn: fetch});
        let caught: unknown;
        try {
            await startOperation(t, spec);
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(KinstaApiError);
        expect((caught as KinstaApiError).status).toBe(0);
    });

    it('sets message to null when the start body has none', async () => {
        const {fetch} = fakeKinsta({
            'POST /sites/tools/clear-cache': {
                status: 202,
                body: {operation_id: 'a:b'},
            },
        });
        const op = await startOperation(
            new HttpTransport({apiKey: 'k', fetchFn: fetch}),
            spec,
        );
        expect(op.message).toBeNull();
    });
});
