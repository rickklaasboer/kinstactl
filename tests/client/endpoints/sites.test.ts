import {describe, expect, test} from 'bun:test';
import {listRegions} from '@/client/endpoints/account';
import {
    changeSitePhpAllocation,
    cloneSite,
    createPlainSite,
    createSite,
    deleteSite,
    resetSite,
} from '@/client/endpoints/sites';

describe('sites lifecycle builders', () => {
    test('createSite', () => {
        const body = {
            company: 'c1',
            display_name: 'My Other Site',
            region: 'europe-west4',
            install_mode: 'new' as const,
            admin_user: 'admin',
            admin_email: 'a@b.nl',
            admin_password: 's3cret',
            site_title: 'My Other Site',
            wp_language: 'en_US',
        };
        expect(createSite(body)).toEqual({
            endpoint: 'POST /sites',
            method: 'POST',
            path: '/sites',
            body,
            creation: true,
        });
    });
    test('createPlainSite', () => {
        expect(createPlainSite('c1', 'My Other Site', 'europe-west4')).toEqual({
            endpoint: 'POST /sites/plain',
            method: 'POST',
            path: '/sites/plain',
            body: {
                company: 'c1',
                display_name: 'My Other Site',
                region: 'europe-west4',
            },
            creation: true,
        });
    });
    test('cloneSite', () => {
        expect(cloneSite('c1', 'My Other Site', 'env-stg')).toEqual({
            endpoint: 'POST /sites/clone',
            method: 'POST',
            path: '/sites/clone',
            body: {
                company: 'c1',
                display_name: 'My Other Site',
                source_env_id: 'env-stg',
            },
            creation: true,
        });
    });
    test('deleteSite encodes the id', () => {
        expect(deleteSite('a/b')).toEqual({
            endpoint: 'DELETE /sites/{site_id}',
            method: 'DELETE',
            path: '/sites/a%2Fb',
        });
    });
    test('resetSite', () => {
        expect(resetSite('id-x', 'pw')).toEqual({
            endpoint: 'POST /sites/{site_id}/reset-site',
            method: 'POST',
            path: '/sites/id-x/reset-site',
            body: {admin_password: 'pw'},
        });
    });
    test('changeSitePhpAllocation', () => {
        expect(
            changeSitePhpAllocation('id-x', {
                threadCount: 4,
                threadMemory: 256,
            }),
        ).toEqual({
            endpoint: 'POST /sites/{site_id}/change-site-php-allocation',
            method: 'POST',
            path: '/sites/id-x/change-site-php-allocation',
            body: {thread_count: 4, thread_memory: 256},
        });
    });
    test('listRegions', () => {
        expect(listRegions('c 1')).toEqual({
            endpoint: 'GET /company/{id}/available-regions',
            method: 'GET',
            path: '/company/c%201/available-regions',
        });
    });
});
