import {describe, expect, test} from 'bun:test';
import * as account from '@/client/endpoints/account';

describe('account', () => {
    test('getCompanyUser', () => {
        expect(account.getCompanyUser('c 1', 'u/1')).toEqual({
            endpoint: 'GET /company/{id}/users/{id_user}',
            method: 'GET',
            path: '/company/c%201/users/u%2F1',
        });
    });

    test('listApiKeys', () => {
        expect(account.listApiKeys('c1')).toEqual({
            endpoint: 'GET /company/{id}/api-keys',
            method: 'GET',
            path: '/company/c1/api-keys',
        });
    });

    test('listActivityLogs without a query sends none', () => {
        expect(account.listActivityLogs('c1')).toEqual({
            endpoint: 'GET /company/{id}/activity-logs',
            method: 'GET',
            path: '/company/c1/activity-logs',
        });
    });

    test('listActivityLogs maps every option onto its query key', () => {
        expect(
            account.listActivityLogs('c1', {
                limit: 5,
                offset: 10,
                category: 'siteActions',
                siteId: 's1',
                initiatedBy: 'u1',
                apiKeyId: 'k1',
                language: 'nl',
            }).query,
        ).toEqual({
            limit: '5',
            offset: '10',
            category: 'siteActions',
            site_id: 's1',
            id_initiated_by: 'u1',
            id_api_key: 'k1',
            language: 'nl',
        });
    });

    test('setCompanyRole', () => {
        expect(account.setCompanyRole('c1', 'u1', 'company-billing')).toEqual({
            endpoint: 'POST /company/{company_id}/users/company-capabilities',
            method: 'POST',
            path: '/company/c1/users/company-capabilities',
            body: {user_id: 'u1', role: 'company-billing'},
        });
    });

    test('setSiteRoles', () => {
        expect(
            account.setSiteRoles(
                'c1',
                ['u1'],
                [{siteId: 's1', role: 'site-admin'}],
            ),
        ).toEqual({
            endpoint: 'POST /company/{company_id}/users/site-capabilities',
            method: 'POST',
            path: '/company/c1/users/site-capabilities',
            body: {
                user_ids: ['u1'],
                site_capabilities: [{site_id: 's1', role: 'site-admin'}],
            },
        });
    });

    test('listCompanyPlugins and listCompanyThemes send no body', () => {
        const plugins = account.listCompanyPlugins('c1');
        expect(plugins).toEqual({
            endpoint: 'GET /company/{id}/wp-plugins',
            method: 'GET',
            path: '/company/c1/wp-plugins',
        });
        expect('body' in plugins).toBe(false);
        expect(account.listCompanyThemes('c1')).toEqual({
            endpoint: 'GET /company/{id}/wp-themes',
            method: 'GET',
            path: '/company/c1/wp-themes',
        });
    });
});
