import type {EndpointKey, RequestSpec} from '@/client/request';

export function listSites(
    companyId: string,
    opts: {includeEnvironments: boolean},
): RequestSpec {
    return {
        endpoint: 'GET /sites',
        method: 'GET',
        path: '/sites',
        query: {
            company: companyId,
            include_environments: String(opts.includeEnvironments),
        },
    };
}

export function getSite(siteId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/{site_id}',
        method: 'GET',
        path: `/sites/${encodeURIComponent(siteId)}`,
    };
}

export const ENDPOINTS: EndpointKey[] = ['GET /sites', 'GET /sites/{site_id}'];
