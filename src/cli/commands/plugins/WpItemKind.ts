import type {components} from '@/client/generated/openapi';
import {
    bulkUpdatePlugins,
    bulkUpdateThemes,
    listPlugins,
    listThemes,
    updatePlugin,
    updateTheme,
} from '@/client/endpoints/plugins';
import type {EndpointKey, RequestSpec} from '@/client/request';

type Schemas = components['schemas'];
export type WpItem =
    Schemas['GetWpSiteEnvironmentWordPressPlugins-Response']['environment']['plugins']['items'][number];

export interface WpItemKind {
    /** Command name, plural. */
    command: 'plugins' | 'themes';
    /** Singular, for messages. */
    noun: 'plugin' | 'theme';
    list: (envId: string) => RequestSpec;
    update: (envId: string, name: string, version: string) => RequestSpec;
    bulk: (envId: string, names: string[]) => RequestSpec;
    endpoints: {
        list: EndpointKey;
        update: EndpointKey;
        bulk: EndpointKey;
    };
}

export const PLUGINS: WpItemKind = {
    command: 'plugins',
    noun: 'plugin',
    list: listPlugins,
    update: updatePlugin,
    bulk: bulkUpdatePlugins,
    endpoints: {
        list: 'GET /sites/environments/{env_id}/wp-plugins',
        update: 'PUT /sites/environments/{env_id}/plugins',
        bulk: 'PUT /sites/environments/{env_id}/plugins/bulk-update',
    },
};

export const THEMES: WpItemKind = {
    command: 'themes',
    noun: 'theme',
    list: listThemes,
    update: updateTheme,
    bulk: bulkUpdateThemes,
    endpoints: {
        list: 'GET /sites/environments/{env_id}/wp-themes',
        update: 'PUT /sites/environments/{env_id}/themes',
        bulk: 'PUT /sites/environments/{env_id}/themes/bulk-update',
    },
};

export const hasUpdate = (i: WpItem) => i.update === 'available';
