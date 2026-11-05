import type {EndpointKey, RequestSpec} from '../request';

export interface LogsOptions {
    fileName: 'error' | 'access' | 'kinsta-cache-perf';
    lines: number;
    from?: string;
    to?: string;
    search?: string;
}

const MAX_LINES = 20000;

export function getLogs(envId: string, opts: LogsOptions): RequestSpec {
    if (
        !Number.isInteger(opts.lines) ||
        opts.lines < 1 ||
        opts.lines > MAX_LINES
    ) {
        throw new RangeError(
            `lines must be an integer between 1 and ${MAX_LINES}, got ${opts.lines}`,
        );
    }
    const query: Record<string, string> = {
        file_name: opts.fileName,
        lines: String(opts.lines),
    };
    if (opts.from !== undefined) query.from = opts.from;
    if (opts.to !== undefined) query.to = opts.to;
    if (opts.search !== undefined) query.search = opts.search;
    return {
        endpoint: 'GET /sites/environments/{env_id}/logs',
        method: 'GET',
        path: `/sites/environments/${encodeURIComponent(envId)}/logs`,
        query,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /sites/environments/{env_id}/logs',
];
