import type {components} from '@/client/generated/openapi';
import type {EndpointKey, RequestSpec} from '@/client/request';

type Schemas = components['schemas'];

const base = (envId: string) =>
    `/sites/environments/${encodeURIComponent(envId)}`;

export function listPlugins(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/wp-plugins',
        method: 'GET',
        path: `${base(envId)}/wp-plugins`,
    };
}

export function listThemes(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/wp-themes',
        method: 'GET',
        path: `${base(envId)}/wp-themes`,
    };
}

export function updatePlugin(
    envId: string,
    name: string,
    updateVersion: string,
): RequestSpec {
    const body: Schemas['UpdateWpEnvironmentRequestBodySchema'] = {
        name,
        update_version: updateVersion,
    };
    return {
        endpoint: 'PUT /sites/environments/{env_id}/plugins',
        method: 'PUT',
        path: `${base(envId)}/plugins`,
        body,
    };
}

export function updateTheme(
    envId: string,
    name: string,
    updateVersion: string,
): RequestSpec {
    const body: Schemas['UpdateWpEnvironmentRequestBodySchema'] = {
        name,
        update_version: updateVersion,
    };
    return {
        endpoint: 'PUT /sites/environments/{env_id}/themes',
        method: 'PUT',
        path: `${base(envId)}/themes`,
        body,
    };
}

export function bulkUpdatePlugins(
    envId: string,
    plugins: string[],
): RequestSpec {
    const body: Schemas['BulkUpdateWpEnvironmentPluginsRequestBodySchema'] = {
        plugins: plugins.map((name) => ({name})),
    };
    return {
        endpoint: 'PUT /sites/environments/{env_id}/plugins/bulk-update',
        method: 'PUT',
        path: `${base(envId)}/plugins/bulk-update`,
        body,
    };
}

export function bulkUpdateThemes(envId: string, themes: string[]): RequestSpec {
    const body: Schemas['BulkUpdateWpEnvironmentThemesRequestBodySchema'] = {
        themes: themes.map((name) => ({name})),
    };
    return {
        endpoint: 'PUT /sites/environments/{env_id}/themes/bulk-update',
        method: 'PUT',
        path: `${base(envId)}/themes/bulk-update`,
        body,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /sites/environments/{env_id}/wp-plugins',
    'GET /sites/environments/{env_id}/wp-themes',
    'PUT /sites/environments/{env_id}/plugins',
    'PUT /sites/environments/{env_id}/themes',
    'PUT /sites/environments/{env_id}/plugins/bulk-update',
    'PUT /sites/environments/{env_id}/themes/bulk-update',
];
