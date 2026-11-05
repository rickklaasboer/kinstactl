import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import type {Command} from 'commander';
import {parse} from 'yaml';
import {buildProgram, getMeta} from '@/cli/program';
import {Runtime, type Io} from '@/cli/runtime';
import {ALL_ENDPOINTS} from '@/client/endpoints';
import type {EndpointKey} from '@/client/request';

const METHODS = ['get', 'post', 'put', 'delete'];

function specOperations(): Set<EndpointKey> {
    const spec = parse(readFileSync('openapi/kinsta-openapi.yaml', 'utf8')) as {
        paths: Record<string, Record<string, {deprecated?: boolean}>>;
    };
    const ops = new Set<EndpointKey>();
    for (const [path, item] of Object.entries(spec.paths)) {
        for (const [method, op] of Object.entries(item)) {
            if (!METHODS.includes(method) || op.deprecated === true) continue;
            ops.add(`${method.toUpperCase()} ${path}` as EndpointKey);
        }
    }
    return ops;
}

// Not yet implemented; plan 2 drives this to empty.
const PENDING = new Set<EndpointKey>([
    'GET /company/{id}/users/{id_user}',
    'GET /company/{id}/api-keys',
    'GET /domains',
    'GET /domains/{domain_id}/dns-records',
    'POST /domains/{domain_id}/dns-records',
    'PUT /domains/{domain_id}/dns-records',
    'DELETE /domains/{domain_id}/dns-records',
    'POST /sites/clone',
    'POST /sites/plain',
    'POST /sites',
    'DELETE /sites/{site_id}',
    'POST /sites/environments/{env_id}/domains',
    'DELETE /sites/environments/{env_id}/domains',
    'GET /sites/environments/{env_id}/domains',
    'GET /sites/environments/domains/{site_domain_id}/verification-records',
    'PUT /sites/environments/{env_id}/change-primary-domain',
    'POST /sites/{site_id}/environments',
    'POST /sites/{site_id}/reset-site',
    'POST /sites/{site_id}/environments/plain',
    'POST /sites/{site_id}/environments/clone',
    'DELETE /sites/environments/{env_id}',
    'POST /sites/environments/{env_id}/change-environment-php-allocation',
    'POST /sites/environments/{env_id}/change-webroot-subfolder',
    'POST /sites/{site_id}/change-site-php-allocation',
    'GET /sites/environments/{env_id}/file-list',
    'PUT /sites/edge-caching/status',
    'PUT /sites/cdn/image-optimization',
    'GET /sites/tools/denied-ips',
    'PUT /sites/tools/denied-ips',
    'GET /sites/environments/{env_id}/downloadable-backups',
    'POST /sites/environments/{env_id}/downloadable-backups',
    'GET /sites/environments/{env_id}/next-downloadable-backup-available',
    'PUT /sites/environments/{env_id}/additional-sftp-accounts/toggle-status',
    'POST /sites/environments/{env_id}/additional-sftp-accounts',
    'GET /sites/environments/{env_id}/additional-sftp-accounts',
    'DELETE /sites/environments/additional-sftp-accounts/{sftp_account_id}',
    'GET /sites/environments/{env_id}/redirect-rules',
    'POST /sites/environments/{env_id}/redirect-rules',
    'GET /company/{id}/available-regions',
    'GET /company/{id}/activity-logs',
    'POST /sites/environments/{env_id}/ssh/set-status',
    'GET /sites/environments/{env_id}/ssh/get-status',
    'POST /sites/environments/{env_id}/ssh/set-password-status',
    'POST /sites/environments/{env_id}/ssh/generate-password',
    'GET /sites/environments/{env_id}/ssh/get-allowed-ips',
    'POST /sites/environments/{env_id}/ssh/set-allowed-ips',
    'GET /sites/{site_id}/environments/{env_id}/ssh/config',
    'POST /sites/environments/{env_id}/ssh/change-expiration-interval',
    'GET /sites/environments/{env_id}/ssh/password',
    'GET /sites/{site_id}/usage/visits/this-month',
    'GET /sites/{site_id}/usage/bandwidth/this-month',
    'GET /sites/{site_id}/usage/cdn-bandwidth/this-month',
    'GET /sites/environments/{env_id}/analytics/cdn-bandwidth',
    'GET /sites/environments/{env_id}/analytics/visits',
    'GET /sites/environments/{env_id}/analytics/bandwidth',
    'GET /sites/environments/{env_id}/analytics/diskspace',
    'POST /sites/environments/{env_id}/run-wp-cli-command',
    'POST /sites/environments/{env_id}/pma-login-token',
    'GET /sites/environments/{env_id}/analytics/top-countries',
    'GET /sites/environments/{env_id}/analytics/top-cities',
    'GET /sites/environments/{env_id}/analytics/top-client-ips',
    'GET /sites/environments/{env_id}/analytics/top-asns',
    'GET /sites/environments/{env_id}/analytics/top-browsers',
    'GET /sites/environments/{env_id}/analytics/top-hosts',
    'GET /sites/environments/{env_id}/analytics/top-referrers',
    'GET /sites/environments/{env_id}/analytics/top-uas',
    'GET /sites/environments/{env_id}/analytics/visits-dispersion',
    'GET /sites/environments/{env_id}/analytics/response-codes',
    'GET /company/{id}/wp-plugins',
    'GET /company/{id}/wp-themes',
    'POST /sites/environments/{env_id}/wpa-login-url',
    'POST /sites/environments/{env_id}/wpa-create-user',
    'GET /sites/environments/{env_id}/wpa-user-exists',
    'GET /sites/environments/{env_id}/force-https-status',
    'POST /sites/environments/{env_id}/force-https-status',
    'PUT /sites/environments/{env_id}/bot-protection/level',
    'GET /sites/environments/{env_id}/bot-protection/level',
    'POST /sites/tools/search-and-replace',
    'POST /company/{company_id}/users/company-capabilities',
    'POST /company/{company_id}/users/site-capabilities',
    'PUT /sites/environments/{env_id}/bot-protection/ai-crawlers',
    'GET /sites/environments/{env_id}/bot-protection/ai-crawlers',
    'GET /sites/environments/{env_id}/bot-protection/wp-automations',
    'PUT /sites/environments/{env_id}/bot-protection/wp-automations',
    'POST /sites/environments/{env_id}/bot-protection/exception-rules',
    'GET /sites/environments/{env_id}/bot-protection/exception-rules',
    'DELETE /sites/environments/{env_id}/bot-protection/exception-rules',
    'GET /sites/environments/{env_id}/analytics/bot-protection/traffic-flow',
    'GET /sites/environments/{env_id}/analytics/bot-protection/requests',
    'GET /sites/environments/{env_id}/analytics/bot-protection/protection-results',
    'GET /sites/environments/{env_id}/analytics/bot-protection/top-breakdown',
]);

test('every spec operation is implemented or pending', () => {
    const missing = [...specOperations()].filter(
        (k) => !ALL_ENDPOINTS.includes(k) && !PENDING.has(k),
    );
    expect(missing).toEqual([]);
});

test('nothing is both implemented and pending', () => {
    expect(ALL_ENDPOINTS.filter((k) => PENDING.has(k))).toEqual([]);
});

test('nothing pending is unknown to the spec', () => {
    const ops = specOperations();
    expect([...PENDING].filter((k) => !ops.has(k))).toEqual([]);
});

// Client endpoints no command uses yet; each command task removes the keys it claims.
const COMMAND_PENDING = new Set<EndpointKey>([
    'GET /company/{id}/users',
    'GET /sites',
    'GET /sites/{site_id}',
    'GET /sites/{site_id}/environments',
    'PUT /sites/{site_id}/environments',
    'POST /sites/tools/clear-cache',
    'POST /sites/tools/restart-php',
    'PUT /sites/tools/modify-php-version',
    'POST /sites/edge-caching/clear',
    'POST /sites/cdn/clear-cache',
    'GET /sites/environments/{env_id}/backups',
    'POST /sites/environments/{env_id}/manual-backups',
    'POST /sites/environments/{target_env_id}/backups/restore',
    'DELETE /sites/environments/backups/{backup_id}',
    'GET /sites/environments/{env_id}/logs',
    'GET /sites/environments/{env_id}/wp-plugins',
    'GET /sites/environments/{env_id}/wp-themes',
    'PUT /sites/environments/{env_id}/plugins',
    'PUT /sites/environments/{env_id}/themes',
    'PUT /sites/environments/{env_id}/plugins/bulk-update',
    'PUT /sites/environments/{env_id}/themes/bulk-update',
    'GET /operations/{operation_id}',
]);

function claimedByCommands(): Set<EndpointKey> {
    const io: Io = {
        stdout() {},
        stderr() {},
        isTTY: false,
        env: {},
        prompts: {} as Io['prompts'],
    };
    const claimed = new Set<EndpointKey>();
    const walk = (cmd: Command) => {
        for (const k of getMeta(cmd)?.endpoints ?? []) claimed.add(k);
        cmd.commands.forEach(walk);
    };
    walk(buildProgram(new Runtime(io)));
    return claimed;
}

test('every client endpoint is claimed by a command or pending', () => {
    const claimed = claimedByCommands();
    expect(
        ALL_ENDPOINTS.filter((k) => !claimed.has(k) && !COMMAND_PENDING.has(k)),
    ).toEqual([]);
});

test('nothing is both claimed by a command and command-pending', () => {
    const claimed = claimedByCommands();
    expect([...COMMAND_PENDING].filter((k) => claimed.has(k))).toEqual([]);
});

test('nothing command-pending is unknown to the client', () => {
    expect(
        [...COMMAND_PENDING].filter((k) => !ALL_ENDPOINTS.includes(k)),
    ).toEqual([]);
});
