import type {components} from '@/client/generated/openapi';
import {CliError} from '../../errors';
import type {Output} from '../../output';
import type {Shape} from './metrics';

type Schemas = components['schemas'];
type Table = Output['table'];

interface Dataset {
    key: string;
    value: string;
}

function required<T>(value: T | undefined, what: string): T {
    if (value === undefined || value === null)
        throw new CliError('API_ERROR', `Analytics response has no ${what}`);
    return value;
}

function responseData<D>(body: unknown): D[] {
    return required(
        (body as {analytics?: {analytics_response?: {data?: D[]}}}).analytics
            ?.analytics_response?.data,
        'analytics_response.data',
    );
}

function keyValue(table: Table, rows: Dataset[]): void {
    table(
        rows,
        [
            {header: 'KEY', value: (r) => r.key},
            {header: 'VALUE', value: (r) => r.value},
        ],
        rows,
    );
}

function dateRequests(
    table: Table,
    rows: {date: string; requests: number}[],
): void {
    table(
        rows,
        [
            {header: 'DATE', value: (r) => r.date},
            {header: 'REQUESTS', value: (r) => String(r.requests)},
        ],
        rows,
    );
}

function label(row: {label: string; total: number}): string {
    return `${row.label} (total ${row.total})`;
}

/**
 * Human rendering of one analytics response. `heading` prints a line on
 * stdout and is only called in human mode.
 */
export function renderAnalytics(
    shape: Shape,
    body: unknown,
    table: Table,
    heading: (text: string) => void,
): void {
    switch (shape) {
        case 'series': {
            const data = responseData<{
                name: string;
                total: number;
                dataset: Dataset[];
            }>(body);
            for (const series of data) {
                heading(`${series.name} (total ${series.total})`);
                keyValue(table, series.dataset);
            }
            return;
        }
        case 'top': {
            const data = responseData<{
                name?: string;
                ip?: string;
                views?: string;
                value?: string;
            }>(body);
            const byIp = data.some((r) => r.ip !== undefined);
            table(
                data,
                byIp
                    ? [
                          {header: 'IP', value: (r) => r.ip ?? ''},
                          {header: 'REQUESTS', value: (r) => r.value ?? ''},
                      ]
                    : [
                          {header: 'NAME', value: (r) => r.name ?? ''},
                          {header: 'VIEWS', value: (r) => r.views ?? ''},
                      ],
                data,
            );
            return;
        }
        case 'dispersion': {
            const data = responseData<{
                name: string;
                dataset: {date: string; percent: string}[];
            }>(body);
            const rows = data.flatMap((d) =>
                d.dataset.map((p) => ({name: d.name, ...p})),
            );
            table(
                rows,
                [
                    {header: 'NAME', value: (r) => r.name},
                    {header: 'DATE', value: (r) => r.date},
                    {header: 'PERCENT', value: (r) => r.percent},
                ],
                rows,
            );
            return;
        }
        case 'response-codes': {
            const data = responseData<{
                response_code: string;
                data: Dataset[];
            }>(body);
            for (const code of data) {
                heading(code.response_code);
                keyValue(table, code.data);
            }
            return;
        }
        case 'bot-flow': {
            const flow = required(
                (body as Schemas['BotTrafficFlow-Response']).analytics
                    ?.traffic_flow,
                'traffic_flow',
            );
            table(
                flow.traffic_types,
                [
                    {header: 'TRAFFIC TYPE', value: (r) => r.label},
                    {header: 'TOTAL', value: (r) => String(r.total)},
                ],
                flow.traffic_types,
            );
            table(
                flow.results,
                [
                    {header: 'RESULT', value: (r) => r.label},
                    {header: 'TOTAL', value: (r) => String(r.total)},
                ],
                flow.results,
            );
            return;
        }
        case 'bot-timeline': {
            const analytics = (
                body as Partial<
                    Schemas['BotTrafficRequests-Response'] &
                        Schemas['BotProtectionResults-Response']
                >
            ).analytics;
            const entries = required(
                analytics?.requests_over_time ??
                    analytics?.protection_results_over_time,
                'requests_over_time or protection_results_over_time',
            );
            for (const entry of entries) {
                heading(label(entry));
                dateRequests(table, entry.timeline);
            }
            return;
        }
        case 'bot-breakdown': {
            const entries = required(
                (body as Schemas['BotTopBreakdown-Response']).analytics
                    ?.top_requests_breakdown,
                'top_requests_breakdown',
            );
            for (const entry of entries) {
                heading(label(entry));
                const sections = [
                    ['PATH', entry.breakdowns.top_paths],
                    ['USER AGENT', entry.breakdowns.top_user_agents],
                    ['COUNTRY', entry.breakdowns.top_countries],
                    ['IP', entry.breakdowns.top_ips],
                ] as const;
                for (const [header, rows] of sections)
                    table(
                        [...rows],
                        [
                            {header, value: (r) => r.value},
                            {
                                header: 'REQUESTS',
                                value: (r) => String(r.requests),
                            },
                        ],
                        rows,
                    );
            }
            return;
        }
    }
}
