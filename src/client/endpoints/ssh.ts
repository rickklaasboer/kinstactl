import type {components} from '../generated/openapi';
import type {EndpointKey, RequestSpec} from '../request';

type Schemas = components['schemas'];

export type SshPasswordExpiration =
    Schemas['ChangeSftpPasswordExpiration-Body']['exp_interval'];

const sshPath = (envId: string, tail: string) =>
    `/sites/environments/${encodeURIComponent(envId)}/ssh/${tail}`;

export function getSshStatus(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/ssh/get-status',
        method: 'GET',
        path: sshPath(envId, 'get-status'),
    };
}

export function setSshStatus(envId: string, enabled: boolean): RequestSpec {
    const body: Schemas['SetSftpSshAccess-Body'] = {is_enabled: enabled};
    return {
        endpoint: 'POST /sites/environments/{env_id}/ssh/set-status',
        method: 'POST',
        path: sshPath(envId, 'set-status'),
        body,
    };
}

export function setSshPasswordStatus(
    envId: string,
    enabled: boolean,
): RequestSpec {
    const body: Schemas['SetSftpSshPasswordAccess-Body'] = {
        is_enabled: enabled,
    };
    return {
        endpoint: 'POST /sites/environments/{env_id}/ssh/set-password-status',
        method: 'POST',
        path: sshPath(envId, 'set-password-status'),
        body,
    };
}

export function generateSshPassword(envId: string): RequestSpec {
    return {
        endpoint: 'POST /sites/environments/{env_id}/ssh/generate-password',
        method: 'POST',
        path: sshPath(envId, 'generate-password'),
    };
}

export function getSshPassword(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/ssh/password',
        method: 'GET',
        path: sshPath(envId, 'password'),
    };
}

export function getSshAllowedIps(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/ssh/get-allowed-ips',
        method: 'GET',
        path: sshPath(envId, 'get-allowed-ips'),
    };
}

export function setSshAllowedIps(envId: string, ips: string[]): RequestSpec {
    const body: Schemas['SetSftpIpAllowlist-Body'] = {ip_allowlist: ips};
    return {
        endpoint: 'POST /sites/environments/{env_id}/ssh/set-allowed-ips',
        method: 'POST',
        path: sshPath(envId, 'set-allowed-ips'),
        body,
    };
}

export function getSshConfig(siteId: string, envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/{site_id}/environments/{env_id}/ssh/config',
        method: 'GET',
        path: `/sites/${encodeURIComponent(siteId)}/environments/${encodeURIComponent(envId)}/ssh/config`,
    };
}

export function setSshPasswordExpiration(
    envId: string,
    interval: SshPasswordExpiration,
): RequestSpec {
    const body: Schemas['ChangeSftpPasswordExpiration-Body'] = {
        exp_interval: interval,
    };
    return {
        endpoint:
            'POST /sites/environments/{env_id}/ssh/change-expiration-interval',
        method: 'POST',
        path: sshPath(envId, 'change-expiration-interval'),
        body,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /sites/environments/{env_id}/ssh/get-status',
    'POST /sites/environments/{env_id}/ssh/set-status',
    'POST /sites/environments/{env_id}/ssh/set-password-status',
    'POST /sites/environments/{env_id}/ssh/generate-password',
    'GET /sites/environments/{env_id}/ssh/password',
    'GET /sites/environments/{env_id}/ssh/get-allowed-ips',
    'POST /sites/environments/{env_id}/ssh/set-allowed-ips',
    'GET /sites/{site_id}/environments/{env_id}/ssh/config',
    'POST /sites/environments/{env_id}/ssh/change-expiration-interval',
];
