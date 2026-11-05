import {expect, test} from 'bun:test';
import {runCli} from '../../helpers/runCli';

interface Node {
    name: string;
    path: string;
    options: {flags: string}[];
    endpoints: string[];
    commands?: Node[];
}

function flatten(n: Node): Node[] {
    return [n, ...(n.commands ?? []).flatMap(flatten)];
}

test('commands --json prints the command tree', async () => {
    const r = await runCli(['commands', '--json']);
    expect(r.code).toBe(0);
    const all = flatten(JSON.parse(r.stdout) as Node);
    const login = all.find((n) => n.path === 'auth login');
    expect(login).toBeDefined();
    expect(login!.options.map((o) => o.flags.split(/[ ,]/)[0])).toContain(
        '--profile',
    );
    expect(all.find((n) => n.path === 'auth status')!.endpoints).toEqual([
        'GET /validate',
    ]);
});

test('commands without --json prints an indented list', async () => {
    const r = await runCli(['commands']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^auth\b/m);
    expect(r.stdout).toMatch(/^ {2}login\b/m);
});

test('every leaf command help has an example', async () => {
    const tree = JSON.parse(
        (await runCli(['commands', '--json'])).stdout,
    ) as Node;
    const leaves = flatten(tree).filter((n) => !n.commands?.length);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
        const r = await runCli([...leaf.path.split(' '), '--help']);
        expect({path: leaf.path, code: r.code}).toEqual({
            path: leaf.path,
            code: 0,
        });
        expect({path: leaf.path, ok: r.stdout}).toEqual({
            path: leaf.path,
            ok: expect.stringContaining('\nExamples:\n  $ kinstactl '),
        });
    }
});

test('unknown command is a usage error', async () => {
    const r = await runCli(['auht']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('unknown command');
});

test('closed stdout exits 0 quietly', async () => {
    const r = await runCli(['commands', '--json'], {
        io: {
            stdout: () => {
                throw Object.assign(new Error('EPIPE'), {code: 'EPIPE'});
            },
        },
    });
    expect(r.code).toBe(0);
    expect(r.stderr).toBe('');
});
