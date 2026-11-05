import {describe, expect, test} from 'bun:test';
import {
    changeEnvironmentPhpAllocation,
    changeWebrootSubfolder,
    cloneEnvironment,
    createEnvironment,
    createPlainEnvironment,
    deleteEnvironment,
    listFiles,
    WEBROOT_PATTERN,
} from '@/client/endpoints/environments';

describe('environment lifecycle builders', () => {
    test('createEnvironment', () => {
        const body = {
            display_name: 'staging2',
            site_title: 'My Site',
            is_premium: false,
            admin_user: 'admin',
            admin_email: 'a@b.nl',
            admin_password: 's3cret',
            wp_language: 'en_US',
        };
        expect(createEnvironment('s1', body)).toEqual({
            endpoint: 'POST /sites/{site_id}/environments',
            method: 'POST',
            path: '/sites/s1/environments',
            body,
            creation: true,
        });
    });
    test('createPlainEnvironment', () => {
        expect(createPlainEnvironment('s1', 'staging2', true)).toEqual({
            endpoint: 'POST /sites/{site_id}/environments/plain',
            method: 'POST',
            path: '/sites/s1/environments/plain',
            body: {display_name: 'staging2', is_premium: true},
            creation: true,
        });
    });
    test('cloneEnvironment', () => {
        expect(
            cloneEnvironment('s1', {
                displayName: 'staging2',
                isPremium: false,
                sourceEnvId: 'e1',
            }),
        ).toEqual({
            endpoint: 'POST /sites/{site_id}/environments/clone',
            method: 'POST',
            path: '/sites/s1/environments/clone',
            body: {
                display_name: 'staging2',
                is_premium: false,
                source_env_id: 'e1',
            },
            creation: true,
        });
    });
    test('deleteEnvironment', () => {
        expect(deleteEnvironment('e1')).toEqual({
            endpoint: 'DELETE /sites/environments/{env_id}',
            method: 'DELETE',
            path: '/sites/environments/e1',
        });
    });
    test('changeEnvironmentPhpAllocation', () => {
        expect(
            changeEnvironmentPhpAllocation('e1', {
                threadCount: 4,
                threadMemory: 256,
            }),
        ).toEqual({
            endpoint:
                'POST /sites/environments/{env_id}/change-environment-php-allocation',
            method: 'POST',
            path: '/sites/environments/e1/change-environment-php-allocation',
            body: {thread_count: 4, thread_memory: 256},
        });
    });
    test('changeWebrootSubfolder sends only the defined options', () => {
        const spec = changeWebrootSubfolder('e1', '/public');
        expect(spec).toEqual({
            endpoint:
                'POST /sites/environments/{env_id}/change-webroot-subfolder',
            method: 'POST',
            path: '/sites/environments/e1/change-webroot-subfolder',
            body: {web_root_subfolder: '/public'},
        });
        expect(
            changeWebrootSubfolder('e1', '/public', {
                clearAllCache: false,
                refreshPluginsAndThemes: false,
            }).body,
        ).toEqual({
            web_root_subfolder: '/public',
            clear_all_cache: false,
            refresh_plugins_and_themes: false,
        });
    });
    test('listFiles', () => {
        expect(listFiles('e1')).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/file-list',
            method: 'GET',
            path: '/sites/environments/e1/file-list',
        });
    });
    test('WEBROOT_PATTERN follows the spec', () => {
        for (const ok of ['/', '/public', '/a/b', '/release_v1/'])
            expect(WEBROOT_PATTERN.test(ok)).toBe(true);
        for (const bad of ['public', '/pub lic', '', '//'])
            expect(WEBROOT_PATTERN.test(bad)).toBe(false);
    });
});
