import type {components} from '../generated/openapi';
import type {EndpointKey, RequestSpec} from '../request';

type Schemas = components['schemas'];

// The spec pattern for wp_command is checked by the command (WP_COMMAND_PATTERN), not here.
export function runWpCli(envId: string, command: string): RequestSpec {
    const body: Schemas['runWPCLICommand-Body'] = {wp_command: command};
    return {
        endpoint: 'POST /sites/environments/{env_id}/run-wp-cli-command',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(envId)}/run-wp-cli-command`,
        body,
    };
}

export function createWpAdminLoginLink(
    envId: string,
    email: string,
): RequestSpec {
    const body: Schemas['getWpAdminLoginLinkByEmail-Body'] = {email};
    return {
        endpoint: 'POST /sites/environments/{env_id}/wpa-login-url',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(envId)}/wpa-login-url`,
        body,
    };
}

export function createWpAdminUser(
    envId: string,
    user: {email: string; firstName: string; lastName: string},
): RequestSpec {
    const body: Schemas['createWpAdminUser-Body'] = {
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
    };
    return {
        endpoint: 'POST /sites/environments/{env_id}/wpa-create-user',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(envId)}/wpa-create-user`,
        body,
    };
}

export function wpAdminUserExists(envId: string, email: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/wpa-user-exists',
        method: 'GET',
        path: `/sites/environments/${encodeURIComponent(envId)}/wpa-user-exists`,
        query: {email},
    };
}

export function createPmaLoginLink(envId: string): RequestSpec {
    return {
        endpoint: 'POST /sites/environments/{env_id}/pma-login-token',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(envId)}/pma-login-token`,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'POST /sites/environments/{env_id}/run-wp-cli-command',
    'POST /sites/environments/{env_id}/wpa-login-url',
    'POST /sites/environments/{env_id}/wpa-create-user',
    'GET /sites/environments/{env_id}/wpa-user-exists',
    'POST /sites/environments/{env_id}/pma-login-token',
];
