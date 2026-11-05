import {describe, expect, it} from 'bun:test';
import {KinstaApiError} from '@/client/errors';
import {RateLimiter} from '@/client/RateLimiter';
import type {RequestSpec} from '@/client/request';
import {HttpTransport} from '@/client/transport';
import {fakeKinsta, type FakeRoute} from '../helpers/fakeKinsta';

const noSleep = async (_ms: number) => {};
const limiter = () => new RateLimiter({now: () => 0, sleep: noSleep});

function make(routes: Record<string, FakeRoute | FakeRoute[]>, apiKey = 'k') {
    const fake = fakeKinsta(routes);
    const transport = new HttpTransport({
        apiKey,
        limiter: limiter(),
        fetchFn: fake.fetch,
        sleep: noSleep,
    });
    return {transport, calls: fake.calls};
}

const get = (
    path: `/${string}`,
    query?: Record<string, string>,
): RequestSpec => ({
    endpoint: `GET ${path}`,
    method: 'GET',
    path,
    query,
});
const withBody = (
    method: 'POST' | 'PUT' | 'DELETE',
    path: `/${string}`,
    body: unknown,
    creation?: boolean,
): RequestSpec => ({
    endpoint: `${method} ${path}`,
    method,
    path,
    body,
    creation,
});

describe('HttpTransport', () => {
    it('sends bearer auth and query params, no body on GET', async () => {
        const {transport, calls} = make(
            {'GET /sites': {body: {ok: true}}},
            'k123',
        );
        const body = await transport.send<{ok: boolean}>(
            get('/sites', {company: 'c1', include_environments: 'true'}),
        );
        expect(body.ok).toBe(true);
        expect(calls[0]!.url.toString()).toBe(
            'https://api.kinsta.com/v2/sites?company=c1&include_environments=true',
        );
        expect(calls[0]!.headers.get('authorization')).toBe('Bearer k123');
        expect(calls[0]!.body).toBeUndefined();
    });

    it('refuses to send a GET with a body', async () => {
        const {transport} = make({'GET /x': {}});
        await expect(
            transport.raw({...get('/x'), body: {nope: 1}}),
        ).rejects.toThrow('GET requests must not carry a body');
    });

    it('serializes PUT bodies as JSON with content-type', async () => {
        const {transport, calls} = make({
            'PUT /sites/environments/e1/plugins/bulk-update': {},
        });
        await transport.send(
            withBody('PUT', '/sites/environments/e1/plugins/bulk-update', {
                plugins: [{name: 'akismet'}],
            }),
        );
        expect(calls[0]!.method).toBe('PUT');
        expect(calls[0]!.headers.get('content-type')).toBe('application/json');
        expect(calls[0]!.body).toEqual({plugins: [{name: 'akismet'}]});
    });

    it('DELETE sends JSON body', async () => {
        const {transport, calls} = make({
            'DELETE /sites/environments/e1/domains': {},
        });
        await transport.send(
            withBody('DELETE', '/sites/environments/e1/domains', {
                domain_ids: ['d1'],
            }),
        );
        expect(calls[0]!.method).toBe('DELETE');
        expect(calls[0]!.headers.get('content-type')).toBe('application/json');
        expect(calls[0]!.body).toEqual({domain_ids: ['d1']});
    });

    it('throws KinstaApiError with the API message on 4xx/5xx', async () => {
        const {transport} = make(
            {
                'GET /validate': {
                    status: 401,
                    body: {message: 'No or invalid API key provided'},
                },
            },
            'bad',
        );
        try {
            await transport.send(get('/validate'));
            expect.unreachable();
        } catch (e) {
            expect(e).toBeInstanceOf(KinstaApiError);
            expect((e as KinstaApiError).status).toBe(401);
            expect((e as KinstaApiError).message).toBe(
                'No or invalid API key provided',
            );
        }
    });

    it('KinstaApiError keeps status and body', async () => {
        const payload = {message: 'Site not found'};
        const {transport} = make({
            'GET /sites/s1': {status: 404, body: payload},
        });
        try {
            await transport.send(get('/sites/s1'));
            expect.unreachable();
        } catch (e) {
            const err = e as KinstaApiError;
            expect(err).toBeInstanceOf(KinstaApiError);
            expect(err.status).toBe(404);
            expect(err.message).toBe('Site not found');
            expect(err.body).toEqual(payload);
        }
    });

    it('retries 429 up to 3 times honoring Retry-After, then surfaces the error', async () => {
        const {transport, calls} = make({
            'GET /sites': {
                status: 429,
                body: {message: 'slow down'},
                headers: {'Retry-After': '1'},
            },
        });
        await expect(transport.send(get('/sites'))).rejects.toThrow(
            'slow down',
        );
        expect(calls.length).toBe(4); // 1 original + 3 retries
    });

    it('recovers when a 429 is followed by success', async () => {
        const {transport, calls} = make({
            'GET /sites': [{status: 429}, {body: {ok: 1}}],
        });
        const body = await transport.send<{ok: number}>(get('/sites'));
        expect(body.ok).toBe(1);
        expect(calls.length).toBe(2);
    });

    /**
     * The 5xx retry below is GET-only, and the 429 retry deliberately is NOT: a rate limit is refused
     * before any work happens, so repeating a POST is safe and necessary. Without this test, adding
     * `method === 'GET'` to the 429 branch for symmetry with its neighbour would keep the suite green
     * while every rate-limited POST and PUT in a large run started hard-failing.
     */
    it('retries a 429 for a NON-GET too, since a rate limit means nothing was done', async () => {
        const {transport, calls} = make({
            'POST /sites/environments/e1/manual-backups': [
                {status: 429},
                {body: {ok: 1}},
            ],
        });
        await expect(
            transport.raw(
                withBody(
                    'POST',
                    '/sites/environments/e1/manual-backups',
                    {tag: 't'},
                    true,
                ),
            ),
        ).resolves.toMatchObject({status: 200});
        expect(calls.length).toBe(2);
    });

    describe('transient gateway 5xx', () => {
        for (const status of [502, 503, 504]) {
            it(`retries a GET on ${status} and succeeds on a later attempt`, async () => {
                const {transport, calls} = make({
                    'GET /sites': [{status}, {status}, {body: {ok: 1}}],
                });
                expect(
                    (await transport.send<{ok: number}>(get('/sites'))).ok,
                ).toBe(1);
                expect(calls.length).toBe(3);
            });
        }

        it('gives up after the retry bound and surfaces the error', async () => {
            const {transport, calls} = make({
                'GET /sites': {status: 504, body: {message: 'Gateway Timeout'}},
            });
            try {
                await transport.send(get('/sites'));
                expect.unreachable();
            } catch (e) {
                expect(e).toBeInstanceOf(KinstaApiError);
                expect((e as KinstaApiError).status).toBe(504);
            }
            expect(calls.length).toBe(4); // 1 original + 3 retries
        });

        // Retrying POST /manual-backups would create a second backup, and a retried bulk update would
        // apply twice, so a non-GET must make exactly ONE request.
        for (const method of ['POST', 'PUT', 'DELETE'] as const) {
            it(`does NOT retry a ${method} on a 5xx`, async () => {
                const {transport, calls} = make({
                    [`${method} /sites/environments/e1/x`]: {
                        status: 504,
                        body: {message: 'Gateway Timeout'},
                    },
                });
                await expect(
                    transport.raw(
                        withBody(method, '/sites/environments/e1/x', {
                            tag: 't',
                        }),
                    ),
                ).resolves.toMatchObject({
                    status: 504,
                });
                expect(calls.length).toBe(1);
            });
        }

        it('does not retry a GET on 500, which /operations uses to mean the operation itself failed', async () => {
            const {transport, calls} = make({
                'GET /operations/op-1': {
                    status: 500,
                    body: {message: 'Operation failed'},
                },
            });
            expect((await transport.raw(get('/operations/op-1'))).status).toBe(
                500,
            );
            expect(calls.length).toBe(1);
        });
    });

    it('creation spec acquires the creation bucket', async () => {
        const fake = fakeKinsta({
            'POST /sites/environments/e1/manual-backups': {},
            'GET /sites': {},
        });
        const acquired: string[] = [];
        const rl = limiter();
        const original = rl.acquire.bind(rl);
        rl.acquire = async (bucket) => {
            acquired.push(bucket);
            return original(bucket);
        };
        const transport = new HttpTransport({
            apiKey: 'k',
            limiter: rl,
            fetchFn: fake.fetch,
            sleep: noSleep,
        });
        await transport.send(
            withBody(
                'POST',
                '/sites/environments/e1/manual-backups',
                {tag: 't'},
                true,
            ),
        );
        expect(acquired).toEqual(['creation', 'general']);
        acquired.length = 0;
        await transport.send(get('/sites'));
        expect(acquired).toEqual(['general']);
    });

    it('timeout aborts after REQUEST_TIMEOUT_MS', async () => {
        // Never resolves on its own; rejects only when the transport's abort signal fires.
        const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
                init!.signal!.addEventListener('abort', () =>
                    reject(init!.signal!.reason),
                );
            })) as typeof fetch;
        const transport = new HttpTransport({
            apiKey: 'k',
            limiter: limiter(),
            fetchFn: hangingFetch,
            sleep: noSleep,
            timeoutMs: 20,
        });
        try {
            await transport.send(get('/sites'));
            expect.unreachable();
        } catch (e) {
            expect(e).toBeInstanceOf(KinstaApiError);
            expect((e as KinstaApiError).status).toBe(0);
            expect((e as KinstaApiError).message).toContain('timed out');
        }
    });
});
