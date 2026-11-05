import {describe, expect, test} from 'bun:test';
import * as ssh from '@/client/endpoints/ssh';

describe('ssh', () => {
    test('getSshStatus', () => {
        expect(ssh.getSshStatus('e1')).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/ssh/get-status',
            method: 'GET',
            path: '/sites/environments/e1/ssh/get-status',
        });
    });
    test('setSshStatus', () => {
        expect(ssh.setSshStatus('e1', true)).toEqual({
            endpoint: 'POST /sites/environments/{env_id}/ssh/set-status',
            method: 'POST',
            path: '/sites/environments/e1/ssh/set-status',
            body: {is_enabled: true},
        });
    });
    test('setSshPasswordStatus', () => {
        expect(ssh.setSshPasswordStatus('e1', false)).toEqual({
            endpoint:
                'POST /sites/environments/{env_id}/ssh/set-password-status',
            method: 'POST',
            path: '/sites/environments/e1/ssh/set-password-status',
            body: {is_enabled: false},
        });
    });
    test('generateSshPassword', () => {
        expect(ssh.generateSshPassword('e1')).toEqual({
            endpoint: 'POST /sites/environments/{env_id}/ssh/generate-password',
            method: 'POST',
            path: '/sites/environments/e1/ssh/generate-password',
        });
    });
    test('getSshPassword', () => {
        expect(ssh.getSshPassword('e1')).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/ssh/password',
            method: 'GET',
            path: '/sites/environments/e1/ssh/password',
        });
    });
    test('getSshAllowedIps', () => {
        expect(ssh.getSshAllowedIps('e1')).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/ssh/get-allowed-ips',
            method: 'GET',
            path: '/sites/environments/e1/ssh/get-allowed-ips',
        });
    });
    test('setSshAllowedIps', () => {
        expect(ssh.setSshAllowedIps('e1', ['1.1.1.1'])).toEqual({
            endpoint: 'POST /sites/environments/{env_id}/ssh/set-allowed-ips',
            method: 'POST',
            path: '/sites/environments/e1/ssh/set-allowed-ips',
            body: {ip_allowlist: ['1.1.1.1']},
        });
    });
    test('getSshConfig', () => {
        expect(ssh.getSshConfig('s1', 'e1')).toEqual({
            endpoint: 'GET /sites/{site_id}/environments/{env_id}/ssh/config',
            method: 'GET',
            path: '/sites/s1/environments/e1/ssh/config',
        });
    });
    test('setSshPasswordExpiration', () => {
        expect(ssh.setSshPasswordExpiration('e1', 'days_7')).toEqual({
            endpoint:
                'POST /sites/environments/{env_id}/ssh/change-expiration-interval',
            method: 'POST',
            path: '/sites/environments/e1/ssh/change-expiration-interval',
            body: {exp_interval: 'days_7'},
        });
    });
});
