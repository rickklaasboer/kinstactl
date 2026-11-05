import type {components} from '../generated/openapi.js';
import type {EndpointKey, RequestSpec} from '../request.js';

type Schemas = components['schemas'];

export type SftpPermission = NonNullable<
    Schemas['AddAdditionalSftpAccountRequestBodySchema']['permission']
>;

const accountsPath = (envId: string) =>
    `/sites/environments/${encodeURIComponent(envId)}/additional-sftp-accounts`;

export function listSftpAccounts(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/additional-sftp-accounts',
        method: 'GET',
        path: accountsPath(envId),
    };
}

export function addSftpAccount(
    envId: string,
    account: {
        username: string;
        password: string;
        rootDirectory?: string;
        permission?: SftpPermission;
    },
): RequestSpec {
    // The generated type makes the defaulted fields required; the API treats them as optional.
    const body: Pick<
        Schemas['AddAdditionalSftpAccountRequestBodySchema'],
        'username' | 'password'
    > &
        Partial<Schemas['AddAdditionalSftpAccountRequestBodySchema']> = {
        username: account.username,
        password: account.password,
        ...(account.rootDirectory !== undefined && {
            root_directory: account.rootDirectory,
        }),
        ...(account.permission !== undefined && {
            permission: account.permission,
        }),
    };
    return {
        endpoint: 'POST /sites/environments/{env_id}/additional-sftp-accounts',
        method: 'POST',
        path: accountsPath(envId),
        body,
    };
}

export function toggleSftpAccounts(
    envId: string,
    enabled: boolean,
): RequestSpec {
    const body: Schemas['ToggleAdditionalSftpAccountsRequestBodySchema'] = {
        enabled,
    };
    return {
        endpoint:
            'PUT /sites/environments/{env_id}/additional-sftp-accounts/toggle-status',
        method: 'PUT',
        path: `${accountsPath(envId)}/toggle-status`,
        body,
    };
}

export function deleteSftpAccount(accountId: string): RequestSpec {
    return {
        endpoint:
            'DELETE /sites/environments/additional-sftp-accounts/{sftp_account_id}',
        method: 'DELETE',
        path: `/sites/environments/additional-sftp-accounts/${encodeURIComponent(accountId)}`,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /sites/environments/{env_id}/additional-sftp-accounts',
    'POST /sites/environments/{env_id}/additional-sftp-accounts',
    'PUT /sites/environments/{env_id}/additional-sftp-accounts/toggle-status',
    'DELETE /sites/environments/additional-sftp-accounts/{sftp_account_id}',
];
