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

test('every spec operation has a client builder', () => {
    expect(
        [...specOperations()].filter((k) => !ALL_ENDPOINTS.includes(k)),
    ).toEqual([]);
});

test('the client has no builder the spec does not know', () => {
    const ops = specOperations();
    expect(ALL_ENDPOINTS.filter((k) => !ops.has(k))).toEqual([]);
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
