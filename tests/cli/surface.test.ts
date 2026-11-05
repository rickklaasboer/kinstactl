import {afterAll, beforeAll, expect, test} from 'bun:test';
import {runCli} from '../helpers/runCli';

interface Node {
    path: string;
    commands: Node[];
}

function flatten(n: Node): Node[] {
    return [n, ...n.commands.flatMap(flatten)];
}

type Stream = 'stdout' | 'stderr';
const originals = new Map<Stream, PropertyDescriptor | undefined>();

// Commander wraps help at the terminal width; pin it to 80 columns.
beforeAll(() => {
    for (const s of ['stdout', 'stderr'] as const) {
        originals.set(s, Object.getOwnPropertyDescriptor(process[s], 'isTTY'));
        Object.defineProperty(process[s], 'isTTY', {
            value: false,
            configurable: true,
        });
    }
});

afterAll(() => {
    for (const [s, d] of originals) {
        if (d) Object.defineProperty(process[s], 'isTTY', d);
        else delete (process[s] as {isTTY?: boolean}).isTTY;
    }
});

test('commands --json is unchanged', async () => {
    const r = await runCli(['commands', '--json']);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchSnapshot();
});

test('commands list is unchanged', async () => {
    const r = await runCli(['commands']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatchSnapshot();
});

test('help of every command and group is unchanged', async () => {
    const tree = JSON.parse(
        (await runCli(['commands', '--json'])).stdout,
    ) as Node;
    for (const node of flatten(tree)) {
        const r = await runCli([
            ...node.path.split(' ').filter(Boolean),
            '--help',
        ]);
        expect({
            path: node.path,
            code: r.code,
            stdout: r.stdout,
            stderr: r.stderr,
        }).toMatchSnapshot();
    }
});
