import {describe, expect, test} from 'bun:test';
import {
    ANALYTICS_PATHS,
    bandwidthUsage,
    cdnBandwidthUsage,
    diskspaceAnalytics,
    ENDPOINTS,
    environmentAnalytics,
    visitsUsage,
} from '@/client/endpoints/analytics';

describe('environmentAnalytics', () => {
    test('builds path, endpoint and query for every analytics path', () => {
        for (const path of ANALYTICS_PATHS) {
            expect(environmentAnalytics('e 1', 'c1', path)).toEqual({
                endpoint: `GET /sites/environments/{env_id}/analytics/${path}`,
                method: 'GET',
                path: `/sites/environments/e%201/analytics/${path}`,
                query: {company_id: 'c1'},
            });
        }
    });

    test('sends only the query parameters that are given', () => {
        expect(
            environmentAnalytics('e1', 'c1', 'visits', {
                timeSpan: '30_days',
                from: '2026-10-01',
                to: '2026-10-31',
            }).query,
        ).toEqual({
            company_id: 'c1',
            time_span: '30_days',
            from: '2026-10-01',
            to: '2026-10-31',
        });
    });
});

describe('diskspaceAnalytics', () => {
    test('sends time_zone next to the other parameters', () => {
        expect(
            diskspaceAnalytics('e1', 'c1', {
                timeSpan: '7_days',
                timeZone: '-05:00',
            }),
        ).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/analytics/diskspace',
            method: 'GET',
            path: '/sites/environments/e1/analytics/diskspace',
            query: {company_id: 'c1', time_span: '7_days', time_zone: '-05:00'},
        });
    });

    test('rejects the 24_hours time span', () => {
        expect(() =>
            diskspaceAnalytics('e1', 'c1', {
                timeSpan: '24_hours',
                timeZone: '02:00',
            }),
        ).toThrow(RangeError);
    });

    test('rejects a time zone outside the pattern', () => {
        for (const timeZone of ['2:00', '05:30', '15:00', '+02:00', 'UTC'])
            expect(() => diskspaceAnalytics('e1', 'c1', {timeZone})).toThrow(
                RangeError,
            );
    });
});

describe('usage builders', () => {
    test('visitsUsage', () => {
        expect(visitsUsage('s 1')).toEqual({
            endpoint: 'GET /sites/{site_id}/usage/visits/this-month',
            method: 'GET',
            path: '/sites/s%201/usage/visits/this-month',
        });
    });
    test('bandwidthUsage', () => {
        expect(bandwidthUsage('s1')).toEqual({
            endpoint: 'GET /sites/{site_id}/usage/bandwidth/this-month',
            method: 'GET',
            path: '/sites/s1/usage/bandwidth/this-month',
        });
    });
    test('cdnBandwidthUsage', () => {
        expect(cdnBandwidthUsage('s1')).toEqual({
            endpoint: 'GET /sites/{site_id}/usage/cdn-bandwidth/this-month',
            method: 'GET',
            path: '/sites/s1/usage/cdn-bandwidth/this-month',
        });
    });
});

test('ENDPOINTS has 21 keys', () => {
    expect(ENDPOINTS).toHaveLength(21);
    expect(new Set(ENDPOINTS).size).toBe(21);
});
