import type {components} from '@/client/generated/openapi';
import type {EndpointKey, RequestSpec} from '@/client/request';

type Schemas = components['schemas'];

export function clearCache(envId: string): RequestSpec {
    const body: Schemas['ClearCacheRequestBody'] = {environment_id: envId};
    return {
        endpoint: 'POST /sites/tools/clear-cache',
        method: 'POST',
        path: '/sites/tools/clear-cache',
        body,
    };
}

export function restartPhp(envId: string): RequestSpec {
    const body: Schemas['RestartPhpEngineRequestBody'] = {
        environment_id: envId,
    };
    return {
        endpoint: 'POST /sites/tools/restart-php',
        method: 'POST',
        path: '/sites/tools/restart-php',
        body,
    };
}

export function modifyPhpVersion(
    envId: string,
    phpVersion: string,
    optOutAutoUpdate?: boolean,
): RequestSpec {
    const body: Schemas['ModifyPhpVersionRequestBody'] = {
        environment_id: envId,
        php_version: phpVersion,
        ...(optOutAutoUpdate !== undefined
            ? {is_opt_out_from_automatic_php_update: optOutAutoUpdate}
            : {}),
    };
    return {
        endpoint: 'PUT /sites/tools/modify-php-version',
        method: 'PUT',
        path: '/sites/tools/modify-php-version',
        body,
    };
}

export function clearEdgeCache(
    envId: string,
    opts: {url?: string; clearSubdirectories?: boolean} = {},
): RequestSpec {
    // The generated type marks defaulted fields as required; the API treats them as optional.
    const body: Partial<Schemas['ClearEdgeCacheRequestBody']> & {
        environment_id: string;
    } = {
        environment_id: envId,
        ...(opts.url !== undefined ? {url: opts.url} : {}),
        ...(opts.clearSubdirectories !== undefined
            ? {clear_subdirectories: opts.clearSubdirectories}
            : {}),
    };
    return {
        endpoint: 'POST /sites/edge-caching/clear',
        method: 'POST',
        path: '/sites/edge-caching/clear',
        body,
    };
}

// The spec requires cdn_cache_id next to environment_id, so the builder takes it as well.
export function clearCdnCache(envId: string, cdnCacheId: string): RequestSpec {
    const body: Schemas['ClearCDNCacheRequestBody'] = {
        environment_id: envId,
        cdn_cache_id: cdnCacheId,
    };
    return {
        endpoint: 'POST /sites/cdn/clear-cache',
        method: 'POST',
        path: '/sites/cdn/clear-cache',
        body,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'POST /sites/tools/clear-cache',
    'POST /sites/tools/restart-php',
    'PUT /sites/tools/modify-php-version',
    'POST /sites/edge-caching/clear',
    'POST /sites/cdn/clear-cache',
];
