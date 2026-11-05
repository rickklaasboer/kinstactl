import type {EndpointKey, RequestSpec} from '@/client/request';

export const ANALYTICS_PATHS = [
    'visits',
    'bandwidth',
    'cdn-bandwidth',
    'top-countries',
    'top-cities',
    'top-client-ips',
    'top-asns',
    'top-browsers',
    'top-hosts',
    'top-referrers',
    'top-uas',
    'visits-dispersion',
    'response-codes',
    'bot-protection/traffic-flow',
    'bot-protection/requests',
    'bot-protection/protection-results',
    'bot-protection/top-breakdown',
] as const;
export type AnalyticsPath = (typeof ANALYTICS_PATHS)[number];

export type TimeSpan = '24_hours' | '7_days' | '30_days' | '60_days';

export interface AnalyticsQuery {
    timeSpan?: TimeSpan;
    from?: string;
    to?: string;
}

export const TIME_ZONE_PATTERN = /^-?(0[0-9]|1[0-4]):00$/;

function analyticsQuery(
    companyId: string,
    query: AnalyticsQuery,
): Record<string, string> {
    const q: Record<string, string> = {company_id: companyId};
    if (query.timeSpan !== undefined) q.time_span = query.timeSpan;
    if (query.from !== undefined) q.from = query.from;
    if (query.to !== undefined) q.to = query.to;
    return q;
}

export function environmentAnalytics(
    envId: string,
    companyId: string,
    path: AnalyticsPath,
    query: AnalyticsQuery = {},
): RequestSpec {
    return {
        endpoint: `GET /sites/environments/{env_id}/analytics/${path}`,
        method: 'GET',
        path: `/sites/environments/${encodeURIComponent(envId)}/analytics/${path}`,
        query: analyticsQuery(companyId, query),
    };
}

export function diskspaceAnalytics(
    envId: string,
    companyId: string,
    query: AnalyticsQuery & {timeZone: string},
): RequestSpec {
    if (query.timeSpan === '24_hours')
        throw new RangeError('disk space analytics have no 24_hours time span');
    if (!TIME_ZONE_PATTERN.test(query.timeZone))
        throw new RangeError(
            `time zone must look like 02:00 or -05:00, got ${query.timeZone}`,
        );
    return {
        endpoint: 'GET /sites/environments/{env_id}/analytics/diskspace',
        method: 'GET',
        path: `/sites/environments/${encodeURIComponent(envId)}/analytics/diskspace`,
        query: {
            ...analyticsQuery(companyId, query),
            time_zone: query.timeZone,
        },
    };
}

function usage(
    siteId: string,
    metric: 'visits' | 'bandwidth' | 'cdn-bandwidth',
): RequestSpec {
    return {
        endpoint: `GET /sites/{site_id}/usage/${metric}/this-month`,
        method: 'GET',
        path: `/sites/${encodeURIComponent(siteId)}/usage/${metric}/this-month`,
    };
}

export function visitsUsage(siteId: string): RequestSpec {
    return usage(siteId, 'visits');
}

export function bandwidthUsage(siteId: string): RequestSpec {
    return usage(siteId, 'bandwidth');
}

export function cdnBandwidthUsage(siteId: string): RequestSpec {
    return usage(siteId, 'cdn-bandwidth');
}

export const ENDPOINTS: EndpointKey[] = [
    ...ANALYTICS_PATHS.map(
        (p): EndpointKey => `GET /sites/environments/{env_id}/analytics/${p}`,
    ),
    'GET /sites/environments/{env_id}/analytics/diskspace',
    'GET /sites/{site_id}/usage/visits/this-month',
    'GET /sites/{site_id}/usage/bandwidth/this-month',
    'GET /sites/{site_id}/usage/cdn-bandwidth/this-month',
];
