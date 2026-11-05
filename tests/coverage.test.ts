import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {CommandRegistry} from '@/cli/CommandRegistry';
import type {Io} from '@/cli/io';
import {createProgramContainer} from '@/cli/program';
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
    'GET /sites/tools/denied-ips',
    'PUT /sites/tools/denied-ips',
    'PUT /sites/environments/{env_id}/additional-sftp-accounts/toggle-status',
    'POST /sites/environments/{env_id}/additional-sftp-accounts',
    'GET /sites/environments/{env_id}/additional-sftp-accounts',
    'DELETE /sites/environments/additional-sftp-accounts/{sftp_account_id}',
    'GET /sites/environments/{env_id}/redirect-rules',
    'POST /sites/environments/{env_id}/redirect-rules',
    'POST /sites/environments/{env_id}/ssh/set-status',
    'GET /sites/environments/{env_id}/ssh/get-status',
    'POST /sites/environments/{env_id}/ssh/set-password-status',
    'POST /sites/environments/{env_id}/ssh/generate-password',
    'GET /sites/environments/{env_id}/ssh/get-allowed-ips',
    'POST /sites/environments/{env_id}/ssh/set-allowed-ips',
    'GET /sites/{site_id}/environments/{env_id}/ssh/config',
    'POST /sites/environments/{env_id}/ssh/change-expiration-interval',
    'GET /sites/environments/{env_id}/ssh/password',
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

function claimedByCommands(): Set<EndpointKey> {
    const io: Io = {
        stdout() {},
        stderr() {},
        isTTY: false,
        env: {},
        progressOutput: process.stderr,
        prompts: {} as Io['prompts'],
    };
    return new Set(
        createProgramContainer(io)
            .resolve(CommandRegistry)
            .commands()
            .flatMap((c) => c.endpoints),
    );
}

test('every client endpoint is claimed by a command class', () => {
    const claimed = claimedByCommands();
    expect(ALL_ENDPOINTS.filter((k) => !claimed.has(k))).toEqual([]);
});

test('every endpoint a command claims exists in the client', () => {
    expect(
        [...claimedByCommands()].filter((k) => !ALL_ENDPOINTS.includes(k)),
    ).toEqual([]);
});
