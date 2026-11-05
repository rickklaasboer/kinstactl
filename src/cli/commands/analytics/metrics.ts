import type {AnalyticsPath, TimeSpan} from '@/client/endpoints/analytics';

export type Shape =
    | 'series'
    | 'top'
    | 'dispersion'
    | 'response-codes'
    | 'bot-flow'
    | 'bot-timeline'
    | 'bot-breakdown';

export interface Metric {
    name: string;
    path: AnalyticsPath | 'diskspace';
    shape: Shape;
    description: string;
}

export const METRICS: Metric[] = [
    {
        name: 'visits',
        path: 'visits',
        shape: 'series',
        description: 'visits over time',
    },
    {
        name: 'bandwidth',
        path: 'bandwidth',
        shape: 'series',
        description: 'bandwidth over time',
    },
    {
        name: 'cdn-bandwidth',
        path: 'cdn-bandwidth',
        shape: 'series',
        description: 'CDN bandwidth over time',
    },
    {
        name: 'diskspace',
        path: 'diskspace',
        shape: 'series',
        description: 'disk space over time (7d, 30d or 60d)',
    },
    {
        name: 'top-countries',
        path: 'top-countries',
        shape: 'top',
        description: 'countries with the most visits',
    },
    {
        name: 'top-cities',
        path: 'top-cities',
        shape: 'top',
        description: 'cities with the most visits',
    },
    {
        name: 'top-ips',
        path: 'top-client-ips',
        shape: 'top',
        description: 'client IPs with the most requests',
    },
    {
        name: 'top-asns',
        path: 'top-asns',
        shape: 'top',
        description: 'ASNs with the most visits',
    },
    {
        name: 'top-browsers',
        path: 'top-browsers',
        shape: 'top',
        description: 'browsers with the most visits',
    },
    {
        name: 'top-hosts',
        path: 'top-hosts',
        shape: 'top',
        description: 'hosts with the most visits',
    },
    {
        name: 'top-referrers',
        path: 'top-referrers',
        shape: 'top',
        description: 'referrers with the most visits',
    },
    {
        name: 'top-user-agents',
        path: 'top-uas',
        shape: 'top',
        description: 'user agents with the most visits',
    },
    {
        name: 'visits-dispersion',
        path: 'visits-dispersion',
        shape: 'dispersion',
        description: 'visit dispersion',
    },
    {
        name: 'response-codes',
        path: 'response-codes',
        shape: 'response-codes',
        description: 'HTTP response codes over time',
    },
    {
        name: 'bot-traffic-flow',
        path: 'bot-protection/traffic-flow',
        shape: 'bot-flow',
        description: 'bot protection traffic types and results',
    },
    {
        name: 'bot-requests',
        path: 'bot-protection/requests',
        shape: 'bot-timeline',
        description: 'requests per traffic type over time',
    },
    {
        name: 'bot-protection-results',
        path: 'bot-protection/protection-results',
        shape: 'bot-timeline',
        description: 'bot protection results over time',
    },
    {
        name: 'bot-top-breakdown',
        path: 'bot-protection/top-breakdown',
        shape: 'bot-breakdown',
        description:
            'top paths, user agents, countries and IPs per traffic type',
    },
];

export const SPANS: Record<'24h' | '7d' | '30d' | '60d', TimeSpan> = {
    '24h': '24_hours',
    '7d': '7_days',
    '30d': '30_days',
    '60d': '60_days',
};

/** UTC offset of `now` as the API wants it, e.g. '02:00' or '-05:00'; partial hours round toward zero. */
export function localTimeZone(now: Date): string {
    const hours = Math.trunc(-now.getTimezoneOffset() / 60);
    const digits = String(Math.abs(hours)).padStart(2, '0');
    return `${hours < 0 ? '-' : ''}${digits}:00`;
}
