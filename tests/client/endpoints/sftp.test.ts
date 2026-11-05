import {describe, expect, test} from 'bun:test';
import * as sftp from '@/client/endpoints/sftp';

describe('sftp', () => {
    test('listSftpAccounts', () => {
        expect(sftp.listSftpAccounts('e1')).toEqual({
            endpoint:
                'GET /sites/environments/{env_id}/additional-sftp-accounts',
            method: 'GET',
            path: '/sites/environments/e1/additional-sftp-accounts',
        });
    });
    test('addSftpAccount sends only the defined fields', () => {
        expect(
            sftp.addSftpAccount('e1', {username: 'u', password: 'p'}),
        ).toEqual({
            endpoint:
                'POST /sites/environments/{env_id}/additional-sftp-accounts',
            method: 'POST',
            path: '/sites/environments/e1/additional-sftp-accounts',
            body: {username: 'u', password: 'p'},
        });
        expect(
            sftp.addSftpAccount('e1', {
                username: 'u',
                password: 'p',
                rootDirectory: '/dir',
                permission: 'write',
            }).body,
        ).toEqual({
            username: 'u',
            password: 'p',
            root_directory: '/dir',
            permission: 'write',
        });
    });
    test('toggleSftpAccounts', () => {
        expect(sftp.toggleSftpAccounts('e1', false)).toEqual({
            endpoint:
                'PUT /sites/environments/{env_id}/additional-sftp-accounts/toggle-status',
            method: 'PUT',
            path: '/sites/environments/e1/additional-sftp-accounts/toggle-status',
            body: {enabled: false},
        });
    });
    test('deleteSftpAccount', () => {
        expect(sftp.deleteSftpAccount('a1')).toEqual({
            endpoint:
                'DELETE /sites/environments/additional-sftp-accounts/{sftp_account_id}',
            method: 'DELETE',
            path: '/sites/environments/additional-sftp-accounts/a1',
        });
    });
});
