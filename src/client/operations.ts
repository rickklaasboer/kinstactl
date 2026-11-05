import {getOperation} from '@/client/endpoints/operations';
import {
    KinstaApiError,
    OperationFailedError,
    OperationTimeoutError,
} from '@/client/errors';
import type {RequestSpec} from '@/client/request';
import {
    type HttpTransport,
    type RawResponse,
    RETRYABLE_GATEWAY_STATUSES,
} from '@/client/transport';

export interface WaitOpts {
    timeoutMs?: number;
    onPoll?: (status: 'pending' | 'done') => void;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
}

const DEFAULT_TIMEOUT_MS = 30 * 60_000;
const FIRST_POLL_MS = 3_000;
const START_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 15_000;
const GROWTH = 1.5;
const NOT_FOUND_GRACE_MS = 20_000;
const MAX_CONSECUTIVE_TRANSIENT_ERRORS = 3;

/** Async detection is by body, never by status code: a 200 can also start an operation. */
export function operationIdOf(body: unknown): string | null {
    const id = (body as {operation_id?: unknown} | null)?.operation_id;
    return typeof id === 'string' && id !== '' ? id : null;
}

export class Operation {
    constructor(
        private readonly transport: HttpTransport,
        readonly id: string,
        readonly message: string | null,
    ) {}

    /** One poll. A string is the cause of a transient failure; anything else is rethrown. */
    private async pollOnce(spec: RequestSpec): Promise<RawResponse | string> {
        try {
            const res = await this.transport.raw(spec);
            return RETRYABLE_GATEWAY_STATUSES.has(res.status)
                ? `HTTP ${res.status}`
                : res;
        } catch (e) {
            // Only network failures and timeouts (status 0) say nothing about the operation.
            if (e instanceof KinstaApiError && e.status === 0) return e.message;
            throw e;
        }
    }

    async wait(opts: WaitOpts = {}): Promise<void> {
        const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const now = opts.now ?? Date.now;
        const sleep =
            opts.sleep ??
            ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
        const random = opts.random ?? Math.random;
        const jitter = (ms: number) => ms * (0.8 + random() * 0.4);
        const started = now();
        let interval = START_INTERVAL_MS;
        let consecutiveErrors = 0;
        const spec = getOperation(this.id);
        const timeout = () =>
            new OperationTimeoutError(
                this.id,
                `Timed out after ${Math.round(timeoutMs / 60_000)}min waiting for ${this.id}; the Kinsta operation may still complete server-side`,
            );

        await sleep(jitter(FIRST_POLL_MS));
        for (;;) {
            const res = await this.pollOnce(spec);
            if (typeof res === 'string') {
                consecutiveErrors++;
                // The operation may well be running, so this is an unknown outcome, not a failure.
                if (consecutiveErrors > MAX_CONSECUTIVE_TRANSIENT_ERRORS)
                    throw new OperationTimeoutError(
                        this.id,
                        `Lost contact with Kinsta while waiting for ${this.id} (${res}); the operation may still complete server-side`,
                    );
                opts.onPoll?.('pending');
                if (now() - started >= timeoutMs) throw timeout();
                await sleep(jitter(interval));
                interval = Math.min(interval * GROWTH, MAX_INTERVAL_MS);
                continue;
            }
            consecutiveErrors = 0;
            const message = (res.body as {message?: unknown} | null)?.message;
            if (res.status === 401)
                throw new KinstaApiError(
                    401,
                    typeof message === 'string' ? message : 'Unauthorized',
                    res.body,
                );
            if (res.status === 200) {
                opts.onPoll?.('done');
                return;
            }
            if (res.status === 500) {
                throw new OperationFailedError(
                    this.id,
                    typeof message === 'string' ? message : 'Operation failed',
                );
            }
            if (res.status === 404 && now() - started > NOT_FOUND_GRACE_MS) {
                throw new OperationFailedError(
                    this.id,
                    `Operation ${this.id} not found (never started or expired)`,
                );
            }
            if (res.status !== 202 && res.status !== 404) {
                throw new OperationFailedError(
                    this.id,
                    typeof message === 'string'
                        ? message
                        : `Unexpected operation status HTTP ${res.status}`,
                );
            }
            opts.onPoll?.('pending');
            if (now() - started >= timeoutMs) throw timeout();
            await sleep(jitter(interval));
            interval = Math.min(interval * GROWTH, MAX_INTERVAL_MS);
        }
    }
}

export async function startOperation(
    t: HttpTransport,
    spec: RequestSpec,
): Promise<Operation> {
    const body = await t.send<unknown>(spec);
    const id = operationIdOf(body);
    if (id === null) {
        throw new KinstaApiError(
            0,
            `Expected an operation_id from ${spec.endpoint} but the response had none`,
            body,
        );
    }
    const message = (body as {message?: unknown}).message;
    return new Operation(t, id, typeof message === 'string' ? message : null);
}

export function operationFor(t: HttpTransport, id: string): Operation {
    return new Operation(t, id, null);
}
