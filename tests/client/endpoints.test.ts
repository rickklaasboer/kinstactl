import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import * as account from '@/client/endpoints/account';
import * as backups from '@/client/endpoints/backups';
import * as environments from '@/client/endpoints/environments';
import {ALL_ENDPOINTS} from '@/client/endpoints';
import * as logs from '@/client/endpoints/logs';
import * as operations from '@/client/endpoints/operations';
import * as plugins from '@/client/endpoints/plugins';
import * as sites from '@/client/endpoints/sites';
import * as tools from '@/client/endpoints/tools';

describe('account', () => {
    test('validate', () => {
        expect(account.validate()).toEqual({
            endpoint: 'GET /validate',
            method: 'GET',
            path: '/validate',
        });
    });
    test('listCompanyUsers', () => {
        expect(account.listCompanyUsers('c 1')).toEqual({
            endpoint: 'GET /company/{id}/users',
            method: 'GET',
            path: '/company/c%201/users',
        });
    });
});

describe('operations', () => {
    test('getOperation encodes the id', () => {
        expect(operations.getOperation('a/../b')).toEqual({
            endpoint: 'GET /operations/{operation_id}',
            method: 'GET',
            path: '/operations/a%2F..%2Fb',
        });
    });
});

describe('sites', () => {
    test('listSites', () => {
        const spec = sites.listSites('c1', {includeEnvironments: true});
        expect(spec.endpoint).toBe('GET /sites');
        expect(spec.path).toBe('/sites');
        expect(spec.query).toEqual({
            company: 'c1',
            include_environments: 'true',
        });
        expect(
            sites.listSites('c1', {includeEnvironments: false}).query,
        ).toEqual({company: 'c1', include_environments: 'false'});
    });
    test('getSite', () => {
        expect(sites.getSite('s1')).toEqual({
            endpoint: 'GET /sites/{site_id}',
            method: 'GET',
            path: '/sites/s1',
        });
    });
});

describe('environments', () => {
    test('listEnvironments', () => {
        expect(environments.listEnvironments('s1')).toEqual({
            endpoint: 'GET /sites/{site_id}/environments',
            method: 'GET',
            path: '/sites/s1/environments',
        });
    });
    test('pushEnvironment', () => {
        const body = {
            source_env_id: 'a',
            target_env_id: 'b',
            push_db: true,
            push_files: true,
            run_search_and_replace: true,
            push_files_option: 'ALL_FILES' as const,
        };
        expect(environments.pushEnvironment('s1', body)).toEqual({
            endpoint: 'PUT /sites/{site_id}/environments',
            method: 'PUT',
            path: '/sites/s1/environments',
            body,
        });
    });
});

describe('tools', () => {
    test('clearCache', () => {
        expect(tools.clearCache('e1')).toEqual({
            endpoint: 'POST /sites/tools/clear-cache',
            method: 'POST',
            path: '/sites/tools/clear-cache',
            body: {environment_id: 'e1'},
        });
    });
    test('restartPhp', () => {
        expect(tools.restartPhp('e1')).toEqual({
            endpoint: 'POST /sites/tools/restart-php',
            method: 'POST',
            path: '/sites/tools/restart-php',
            body: {environment_id: 'e1'},
        });
    });
    test('modifyPhpVersion', () => {
        expect(tools.modifyPhpVersion('e1', '8.3').body).toEqual({
            environment_id: 'e1',
            php_version: '8.3',
        });
        expect(tools.modifyPhpVersion('e1', '8.3', true)).toEqual({
            endpoint: 'PUT /sites/tools/modify-php-version',
            method: 'PUT',
            path: '/sites/tools/modify-php-version',
            body: {
                environment_id: 'e1',
                php_version: '8.3',
                is_opt_out_from_automatic_php_update: true,
            },
        });
    });
    test('clearEdgeCache', () => {
        expect(tools.clearEdgeCache('e1').body).toEqual({environment_id: 'e1'});
        expect(
            tools.clearEdgeCache('e1', {
                url: 'https://x.nl',
                clearSubdirectories: true,
            }),
        ).toEqual({
            endpoint: 'POST /sites/edge-caching/clear',
            method: 'POST',
            path: '/sites/edge-caching/clear',
            body: {
                environment_id: 'e1',
                url: 'https://x.nl',
                clear_subdirectories: true,
            },
        });
    });
    test('clearCdnCache', () => {
        expect(tools.clearCdnCache('e1', 'cdn1')).toEqual({
            endpoint: 'POST /sites/cdn/clear-cache',
            method: 'POST',
            path: '/sites/cdn/clear-cache',
            body: {environment_id: 'e1', cdn_cache_id: 'cdn1'},
        });
    });
    test('setEdgeCacheStatus', () => {
        expect(tools.setEdgeCacheStatus('e1', false)).toEqual({
            endpoint: 'PUT /sites/edge-caching/status',
            method: 'PUT',
            path: '/sites/edge-caching/status',
            body: {environment_id: 'e1', enabled: false},
        });
    });
    test('setImageOptimization', () => {
        expect(tools.setImageOptimization('e1', 'lossless')).toEqual({
            endpoint: 'PUT /sites/cdn/image-optimization',
            method: 'PUT',
            path: '/sites/cdn/image-optimization',
            body: {environment_id: 'e1', image_optimization_type: 'lossless'},
        });
    });
});

describe('backups', () => {
    test('listBackups', () => {
        expect(backups.listBackups('e1')).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/backups',
            method: 'GET',
            path: '/sites/environments/e1/backups',
        });
    });
    test('createManualBackup', () => {
        const spec = backups.createManualBackup('e1');
        expect(spec.creation).toBe(true);
        expect(spec.path).toBe('/sites/environments/e1/manual-backups');
        expect(spec.body).toEqual({});
        expect(backups.createManualBackup('e1', 'pre-update').body).toEqual({
            tag: 'pre-update',
        });
    });
    test('restoreBackup', () => {
        expect(backups.restoreBackup('t1', 9, 'u1')).toEqual({
            endpoint:
                'POST /sites/environments/{target_env_id}/backups/restore',
            method: 'POST',
            path: '/sites/environments/t1/backups/restore',
            body: {backup_id: 9, notified_user_id: 'u1'},
        });
    });
    test('deleteBackup', () => {
        const spec = backups.deleteBackup(5);
        expect(spec.path).toBe('/sites/environments/backups/5');
        expect(spec.endpoint).toBe(
            'DELETE /sites/environments/backups/{backup_id}',
        );
        expect(spec.method).toBe('DELETE');
    });
});

describe('logs', () => {
    test('getLogs', () => {
        expect(logs.getLogs('e1', {fileName: 'error', lines: 100})).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/logs',
            method: 'GET',
            path: '/sites/environments/e1/logs',
            query: {file_name: 'error', lines: '100'},
        });
        expect(
            logs.getLogs('e1', {
                fileName: 'access',
                lines: 20000,
                from: 'f',
                to: 't',
                search: 's',
            }).query,
        ).toEqual({
            file_name: 'access',
            lines: '20000',
            from: 'f',
            to: 't',
            search: 's',
        });
    });
    test('rejects lines outside 1..20000', () => {
        expect(() =>
            logs.getLogs('e1', {fileName: 'error', lines: 20001}),
        ).toThrow(RangeError);
        expect(() => logs.getLogs('e1', {fileName: 'error', lines: 0})).toThrow(
            RangeError,
        );
        expect(() =>
            logs.getLogs('e1', {fileName: 'error', lines: 1.5}),
        ).toThrow(RangeError);
    });
});

describe('plugins', () => {
    test('list uses the non-deprecated wp-plugins / wp-themes', () => {
        expect(plugins.listPlugins('e1').path).toBe(
            '/sites/environments/e1/wp-plugins',
        );
        expect(plugins.listThemes('e1').path).toBe(
            '/sites/environments/e1/wp-themes',
        );
    });
    test('updatePlugin / updateTheme', () => {
        expect(plugins.updatePlugin('e1', 'akismet', '5.3')).toEqual({
            endpoint: 'PUT /sites/environments/{env_id}/plugins',
            method: 'PUT',
            path: '/sites/environments/e1/plugins',
            body: {name: 'akismet', update_version: '5.3'},
        });
        expect(plugins.updateTheme('e1', 'twentytwentyfour', '1.1')).toEqual({
            endpoint: 'PUT /sites/environments/{env_id}/themes',
            method: 'PUT',
            path: '/sites/environments/e1/themes',
            body: {name: 'twentytwentyfour', update_version: '1.1'},
        });
    });
    test('bulk updates', () => {
        expect(plugins.bulkUpdatePlugins('e1', ['a', 'b'])).toEqual({
            endpoint: 'PUT /sites/environments/{env_id}/plugins/bulk-update',
            method: 'PUT',
            path: '/sites/environments/e1/plugins/bulk-update',
            body: {plugins: [{name: 'a'}, {name: 'b'}]},
        });
        expect(plugins.bulkUpdateThemes('e1', ['t']).body).toEqual({
            themes: [{name: 't'}],
        });
    });
});

test('every ENDPOINTS key exists in the spec', () => {
    const spec = parse(readFileSync('openapi/kinsta-openapi.yaml', 'utf8')) as {
        paths: Record<string, Record<string, unknown>>;
    };
    const known = new Set<string>();
    for (const [path, item] of Object.entries(spec.paths)) {
        for (const method of Object.keys(item))
            known.add(`${method.toUpperCase()} ${path}`);
    }
    for (const key of ALL_ENDPOINTS) expect(known.has(key), key).toBe(true);
    expect(new Set(ALL_ENDPOINTS).size).toBe(ALL_ENDPOINTS.length);
});
