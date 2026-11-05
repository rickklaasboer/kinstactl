import type {components} from '../generated/openapi.js';
import type {EndpointKey, RequestSpec} from '../request.js';

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

export function setEdgeCacheStatus(
    envId: string,
    enabled: boolean,
): RequestSpec {
    const body: Schemas['UpdateEdgeCacheStatusRequestBody'] = {
        environment_id: envId,
        enabled,
    };
    return {
        endpoint: 'PUT /sites/edge-caching/status',
        method: 'PUT',
        path: '/sites/edge-caching/status',
        body,
    };
}

export type ImageOptimizationType =
    Schemas['UpdateImageOptimizationRequestBody']['image_optimization_type'];

export function setImageOptimization(
    envId: string,
    type: ImageOptimizationType,
): RequestSpec {
    const body: Schemas['UpdateImageOptimizationRequestBody'] = {
        environment_id: envId,
        image_optimization_type: type,
    };
    return {
        endpoint: 'PUT /sites/cdn/image-optimization',
        method: 'PUT',
        path: '/sites/cdn/image-optimization',
        body,
    };
}

export const WP_COMMAND_PATTERN = /^wp\s+[a-zA-Z0-9_\-./:=@'\s]+$/;

export function searchAndReplace(
    envId: string,
    opts: {
        search: string;
        replace: string;
        apply: boolean;
        clearCache: boolean;
    },
): RequestSpec {
    const body: Schemas['searchAndReplace-Body'] = {
        environment_id: envId,
        search: opts.search,
        replace: opts.replace,
        perform_replacement: opts.apply,
        is_clear_cache: opts.clearCache,
    };
    return {
        endpoint: 'POST /sites/tools/search-and-replace',
        method: 'POST',
        path: '/sites/tools/search-and-replace',
        body,
    };
}

export function listDeniedIps(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/tools/denied-ips',
        method: 'GET',
        path: '/sites/tools/denied-ips',
        query: {environment_id: envId},
    };
}

export function setDeniedIps(envId: string, ips: string[]): RequestSpec {
    const body: Schemas['UpdateDeniedIPsRequestBody'] = {
        environment_id: envId,
        ip_list: ips,
    };
    return {
        endpoint: 'PUT /sites/tools/denied-ips',
        method: 'PUT',
        path: '/sites/tools/denied-ips',
        body,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'POST /sites/tools/clear-cache',
    'POST /sites/tools/restart-php',
    'PUT /sites/tools/modify-php-version',
    'POST /sites/edge-caching/clear',
    'POST /sites/cdn/clear-cache',
    'PUT /sites/edge-caching/status',
    'PUT /sites/cdn/image-optimization',
    'POST /sites/tools/search-and-replace',
    'GET /sites/tools/denied-ips',
    'PUT /sites/tools/denied-ips',
];
