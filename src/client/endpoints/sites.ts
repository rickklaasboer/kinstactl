import type {components} from '../generated/openapi.js';
import type {EndpointKey, RequestSpec} from '../request.js';

type Schemas = components['schemas'];

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

export function createSite(body: Schemas['addWPSite-Body']): RequestSpec {
    return {
        endpoint: 'POST /sites',
        method: 'POST',
        path: '/sites',
        body,
        creation: true,
    };
}

export function createPlainSite(
    companyId: string,
    displayName: string,
    region: string,
): RequestSpec {
    const body: Schemas['addPlainWPSite-Body'] = {
        company: companyId,
        display_name: displayName,
        region,
    };
    return {
        endpoint: 'POST /sites/plain',
        method: 'POST',
        path: '/sites/plain',
        body,
        creation: true,
    };
}

export function cloneSite(
    companyId: string,
    displayName: string,
    sourceEnvId: string,
): RequestSpec {
    const body: Schemas['cloneWPSite-Body'] = {
        company: companyId,
        display_name: displayName,
        source_env_id: sourceEnvId,
    };
    return {
        endpoint: 'POST /sites/clone',
        method: 'POST',
        path: '/sites/clone',
        body,
        creation: true,
    };
}

export function deleteSite(siteId: string): RequestSpec {
    return {
        endpoint: 'DELETE /sites/{site_id}',
        method: 'DELETE',
        path: `/sites/${encodeURIComponent(siteId)}`,
    };
}

export function resetSite(siteId: string, adminPassword: string): RequestSpec {
    const body: Schemas['resetSite-Body'] = {admin_password: adminPassword};
    return {
        endpoint: 'POST /sites/{site_id}/reset-site',
        method: 'POST',
        path: `/sites/${encodeURIComponent(siteId)}/reset-site`,
        body,
    };
}

export interface PhpAllocation {
    threadCount: number;
    threadMemory: number;
}

export function changeSitePhpAllocation(
    siteId: string,
    alloc: PhpAllocation,
): RequestSpec {
    const body: Schemas['changeSitePhpAllocation-Body'] = {
        thread_count: alloc.threadCount,
        thread_memory: alloc.threadMemory,
    };
    return {
        endpoint: 'POST /sites/{site_id}/change-site-php-allocation',
        method: 'POST',
        path: `/sites/${encodeURIComponent(siteId)}/change-site-php-allocation`,
        body,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /sites',
    'GET /sites/{site_id}',
    'POST /sites',
    'POST /sites/plain',
    'POST /sites/clone',
    'DELETE /sites/{site_id}',
    'POST /sites/{site_id}/reset-site',
    'POST /sites/{site_id}/change-site-php-allocation',
];
