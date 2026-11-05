import {KinstaApiError} from './errors';
import {RateLimiter} from './RateLimiter';
import type {RequestSpec} from './request';

export interface TransportConfig {
    apiKey: string;
    baseUrl?: string;
    fetchFn?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    limiter?: RateLimiter;
    /** Per-attempt timeout; defaults to REQUEST_TIMEOUT_MS. */
    timeoutMs?: number;
}

export interface RawResponse {
    status: number;
    body: unknown;
    headers: Headers;
    /** True when the body could not be parsed as JSON; `body` is then null. */
    nonJson?: true;
}

const isTimeout = (e: unknown): boolean =>
    e instanceof Error && e.name === 'TimeoutError';

const timeoutError = (spec: RequestSpec, timeoutMs: number): KinstaApiError =>
    new KinstaApiError(
        0,
        `Request to ${spec.endpoint} timed out after ${timeoutMs / 1000}s`,
    );

const DEFAULT_BASE_URL = 'https://api.kinsta.com/v2';

/**
 * Bounds both retryable cases below (a 429, and a transient gateway 5xx on a GET), so a single
 * request can never make more than 1 + this many attempts.
 */
const MAX_RETRIES = 3;

/**
 * Gateway-level failures: Kinsta's edge could not reach or could not get an answer from the API in
 * time. They say nothing about the request itself, so a repeat is worth making. 500 is deliberately
 * NOT here: it is an application error, and `/operations/{id}` uses exactly that status to mean
 * "the operation failed", which must surface immediately rather than be retried.
 */
export const RETRYABLE_GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * Generous on purpose. Some Kinsta endpoints are genuinely slow (`/sites?include_environments=true`
 * on a large company takes a while), so this is a backstop against a socket that hangs forever, not
 * a latency budget. It is per ATTEMPT and comfortably shorter than any caller's overall wait:
 * operation polling uses quick GETs and tolerates a run of transient errors before it gives up, so
 * a rare abort here costs one poll, never the whole wait.
 */
const REQUEST_TIMEOUT_MS = 120_000;

export class HttpTransport {
    private limiter: RateLimiter;

    constructor(private cfg: TransportConfig) {
        this.limiter = cfg.limiter ?? new RateLimiter();
    }

    async raw(spec: RequestSpec): Promise<RawResponse> {
        const {method, path, query, body} = spec;
        if (method === 'GET' && body !== undefined) {
            throw new Error(
                'GET requests must not carry a body (Kinsta rollup-style GET bodies are unsupported by fetch)',
            );
        }
        const url = new URL((this.cfg.baseUrl ?? DEFAULT_BASE_URL) + path);
        for (const [k, v] of Object.entries(query ?? {}))
            url.searchParams.set(k, v);
        const fetchFn = this.cfg.fetchFn ?? fetch;
        const sleep =
            this.cfg.sleep ??
            ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
        const timeoutMs = this.cfg.timeoutMs ?? REQUEST_TIMEOUT_MS;

        for (let attempt = 0; ; attempt++) {
            if (spec.creation) await this.limiter.acquire('creation');
            await this.limiter.acquire('general');
            let res: Response;
            try {
                res = await fetchFn(url.toString(), {
                    method,
                    headers: {
                        Authorization: `Bearer ${this.cfg.apiKey}`,
                        ...(body !== undefined
                            ? {'Content-Type': 'application/json'}
                            : {}),
                    },
                    body: body !== undefined ? JSON.stringify(body) : undefined,
                    signal: AbortSignal.timeout(timeoutMs),
                });
            } catch (e) {
                if (isTimeout(e)) throw timeoutError(spec, timeoutMs);
                throw new KinstaApiError(
                    0,
                    `Network error calling ${spec.endpoint}: ${e instanceof Error ? e.message : String(e)}`,
                );
            }
            this.limiter.noteHeaders(res.headers);
            if (res.status === 429 && attempt < MAX_RETRIES) {
                const retryAfter = Number(res.headers.get('Retry-After'));
                await sleep(
                    Number.isFinite(retryAfter) && retryAfter > 0
                        ? retryAfter * 1000
                        : 1000 * 2 ** attempt,
                );
                continue;
            }
            // GET only, and that restriction is the whole point. A gateway 5xx means the request may well
            // have been received and processed, so repeating a POST would create a second backup and
            // repeating a bulk update would apply it twice. A GET is idempotent, so repeating it is free.
            // Every other method surfaces the 5xx to its caller, which must then treat it as "unknown",
            // never as "nothing happened".
            if (
                method === 'GET' &&
                RETRYABLE_GATEWAY_STATUSES.has(res.status) &&
                attempt < MAX_RETRIES
            ) {
                await sleep(1000 * 2 ** attempt);
                continue;
            }
            // The timeout signal stays armed while the body streams, so it can fire here too.
            try {
                const resBody: unknown = await res.json();
                return {
                    status: res.status,
                    body: resBody,
                    headers: res.headers,
                };
            } catch (e) {
                if (isTimeout(e)) throw timeoutError(spec, timeoutMs);
                // An empty or non-JSON body (e.g. a bare gateway error page): callers see null.
                if (!(e instanceof SyntaxError)) throw e;
                return {
                    status: res.status,
                    body: null,
                    headers: res.headers,
                    nonJson: true,
                };
            }
        }
    }

    async send<T>(spec: RequestSpec): Promise<T> {
        const res = await this.raw(spec);
        if (res.status >= 400) {
            const message = (res.body as {message?: unknown} | null)?.message;
            throw new KinstaApiError(
                res.status,
                typeof message === 'string'
                    ? message
                    : `Kinsta API error (HTTP ${res.status})`,
                res.body,
            );
        }
        if (res.nonJson)
            throw new KinstaApiError(
                res.status,
                `Kinsta returned a non-JSON response for ${spec.endpoint}`,
            );
        return res.body as T;
    }
}
