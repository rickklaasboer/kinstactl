export type {paths, components} from './client/generated/openapi.js';
export {KinstaClient, type KinstaClientOptions} from './client/KinstaClient.js';
export {Operation, type WaitOpts} from './client/operations.js';
export {
    KinstaApiError,
    OperationFailedError,
    OperationTimeoutError,
} from './client/errors.js';
export type {RequestSpec, EndpointKey, HttpMethod} from './client/request.js';
export * as account from './client/endpoints/account.js';
export * as sites from './client/endpoints/sites.js';
export * as environments from './client/endpoints/environments.js';
export * as tools from './client/endpoints/tools.js';
export * as backups from './client/endpoints/backups.js';
export * as domains from './client/endpoints/domains.js';
export * as logs from './client/endpoints/logs.js';
export * as plugins from './client/endpoints/plugins.js';
export * as dns from './client/endpoints/dns.js';
export * as wp from './client/endpoints/wp.js';
export * as ssh from './client/endpoints/ssh.js';
export * as sftp from './client/endpoints/sftp.js';
export * as security from './client/endpoints/security.js';
export * as analytics from './client/endpoints/analytics.js';
