export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Spec path template, e.g. 'POST /sites/tools/clear-cache'. */
export type EndpointKey = `${HttpMethod} /${string}`;

export interface RequestSpec {
    endpoint: EndpointKey;
    method: HttpMethod;
    /** Concrete path with parameters substituted, relative to the base URL. */
    path: string;
    query?: Record<string, string>;
    body?: unknown;
    /** Counts against the creation rate-limit bucket as well as the general one. */
    creation?: boolean;
}
