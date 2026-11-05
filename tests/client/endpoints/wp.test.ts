import {describe, expect, test} from 'bun:test';
import * as wp from '@/client/endpoints/wp';

describe('wp', () => {
    test('runWpCli', () => {
        expect(wp.runWpCli('e1', 'wp plugin list')).toEqual({
            endpoint: 'POST /sites/environments/{env_id}/run-wp-cli-command',
            method: 'POST',
            path: '/sites/environments/e1/run-wp-cli-command',
            body: {wp_command: 'wp plugin list'},
        });
    });
    test('createWpAdminLoginLink', () => {
        expect(wp.createWpAdminLoginLink('e1', 'a@example.com')).toEqual({
            endpoint: 'POST /sites/environments/{env_id}/wpa-login-url',
            method: 'POST',
            path: '/sites/environments/e1/wpa-login-url',
            body: {email: 'a@example.com'},
        });
    });
    test('createWpAdminUser', () => {
        expect(
            wp.createWpAdminUser('e1', {
                email: 'a@example.com',
                firstName: 'Ann',
                lastName: 'Lee',
            }),
        ).toEqual({
            endpoint: 'POST /sites/environments/{env_id}/wpa-create-user',
            method: 'POST',
            path: '/sites/environments/e1/wpa-create-user',
            body: {email: 'a@example.com', first_name: 'Ann', last_name: 'Lee'},
        });
    });
    test('wpAdminUserExists', () => {
        expect(wp.wpAdminUserExists('e1', 'a@example.com')).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/wpa-user-exists',
            method: 'GET',
            path: '/sites/environments/e1/wpa-user-exists',
            query: {email: 'a@example.com'},
        });
    });
    test('createPmaLoginLink has no body', () => {
        expect(wp.createPmaLoginLink('e1')).toEqual({
            endpoint: 'POST /sites/environments/{env_id}/pma-login-token',
            method: 'POST',
            path: '/sites/environments/e1/pma-login-token',
        });
    });
});
