import type {components} from '../generated/openapi.js';
import type {EndpointKey, RequestSpec} from '../request.js';
import type {PhpAllocation} from './sites.js';

type Schemas = components['schemas'];

export function listEnvironments(siteId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/{site_id}/environments',
        method: 'GET',
        path: `/sites/${encodeURIComponent(siteId)}/environments`,
    };
}

export function pushEnvironment(
    siteId: string,
    body: Schemas['PushEnvironmentRequestBody'],
): RequestSpec {
    return {
        endpoint: 'PUT /sites/{site_id}/environments',
        method: 'PUT',
        path: `/sites/${encodeURIComponent(siteId)}/environments`,
        body,
    };
}

export function createEnvironment(
    siteId: string,
    body: Schemas['addWPEnvironment-Body'],
): RequestSpec {
    return {
        endpoint: 'POST /sites/{site_id}/environments',
        method: 'POST',
        path: `/sites/${encodeURIComponent(siteId)}/environments`,
        body,
        creation: true,
    };
}

export function createPlainEnvironment(
    siteId: string,
    displayName: string,
    isPremium: boolean,
): RequestSpec {
    const body: Schemas['cloneWpEnvironment-Body'] = {
        display_name: displayName,
        is_premium: isPremium,
    };
    return {
        endpoint: 'POST /sites/{site_id}/environments/plain',
        method: 'POST',
        path: `/sites/${encodeURIComponent(siteId)}/environments/plain`,
        body,
        creation: true,
    };
}

export function cloneEnvironment(
    siteId: string,
    env: {displayName: string; isPremium: boolean; sourceEnvId: string},
): RequestSpec {
    return {
        endpoint: 'POST /sites/{site_id}/environments/clone',
        method: 'POST',
        path: `/sites/${encodeURIComponent(siteId)}/environments/clone`,
        body: {
            display_name: env.displayName,
            is_premium: env.isPremium,
            source_env_id: env.sourceEnvId,
        },
        creation: true,
    };
}

export function deleteEnvironment(envId: string): RequestSpec {
    return {
        endpoint: 'DELETE /sites/environments/{env_id}',
        method: 'DELETE',
        path: `/sites/environments/${encodeURIComponent(envId)}`,
    };
}

export function changeEnvironmentPhpAllocation(
    envId: string,
    alloc: PhpAllocation,
): RequestSpec {
    const body: Schemas['changeEnvironmentPhpAllocation-Body'] = {
        thread_count: alloc.threadCount,
        thread_memory: alloc.threadMemory,
    };
    return {
        endpoint:
            'POST /sites/environments/{env_id}/change-environment-php-allocation',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(envId)}/change-environment-php-allocation`,
        body,
    };
}

/** The spec marks both flags required but defaults them to true, so only explicit values are sent. */
export function changeWebrootSubfolder(
    envId: string,
    subfolder: string,
    opts: {clearAllCache?: boolean; refreshPluginsAndThemes?: boolean} = {},
): RequestSpec {
    const body: Partial<Schemas['changeEnvironmentWebRootSubfolder-Body']> = {
        web_root_subfolder: subfolder,
        ...(opts.clearAllCache !== undefined && {
            clear_all_cache: opts.clearAllCache,
        }),
        ...(opts.refreshPluginsAndThemes !== undefined && {
            refresh_plugins_and_themes: opts.refreshPluginsAndThemes,
        }),
    };
    return {
        endpoint: 'POST /sites/environments/{env_id}/change-webroot-subfolder',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(envId)}/change-webroot-subfolder`,
        body,
    };
}

export function listFiles(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/file-list',
        method: 'GET',
        path: `/sites/environments/${encodeURIComponent(envId)}/file-list`,
    };
}

export const WEBROOT_PATTERN = /^\/([a-zA-Z0-9_-]+\/?)*$/;

export const ENDPOINTS: EndpointKey[] = [
    'GET /sites/{site_id}/environments',
    'PUT /sites/{site_id}/environments',
    'POST /sites/{site_id}/environments',
    'POST /sites/{site_id}/environments/plain',
    'POST /sites/{site_id}/environments/clone',
    'DELETE /sites/environments/{env_id}',
    'POST /sites/environments/{env_id}/change-environment-php-allocation',
    'POST /sites/environments/{env_id}/change-webroot-subfolder',
    'GET /sites/environments/{env_id}/file-list',
];
