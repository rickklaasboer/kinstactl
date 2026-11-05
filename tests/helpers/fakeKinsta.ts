export type FakeRoute = { status?: number; body?: unknown; headers?: Record<string, string> }

export interface FakeCall {
  method: string
  url: URL
  body: unknown
  headers: Headers
}

/**
 * Route key: 'METHOD /path' with the concrete path (without the /v2 prefix, query ignored).
 * An array yields successive responses; the last one repeats. An unrouted request throws.
 */
export function fakeKinsta(routes: Record<string, FakeRoute | FakeRoute[]>): { fetch: typeof fetch; calls: FakeCall[] } {
  const calls: FakeCall[] = []
  const hits: Record<string, number> = {}
  const fakeFetch = (async (input: any, init?: any) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    calls.push({
      method,
      url,
      body: init?.body !== undefined ? JSON.parse(init.body) : undefined,
      headers: new Headers(init?.headers),
    })
    const key = `${method} ${url.pathname.replace(/^\/v2/, '')}`
    const route = routes[key]
    if (route === undefined) throw new Error(`fakeKinsta: no route for ${key}`)
    const n = hits[key] ?? 0
    hits[key] = n + 1
    const r = Array.isArray(route) ? route[Math.min(n, route.length - 1)]! : route
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status ?? 200,
      headers: { 'Content-Type': 'application/json', ...(r.headers ?? {}) },
    })
  }) as typeof fetch
  return { fetch: fakeFetch, calls }
}
