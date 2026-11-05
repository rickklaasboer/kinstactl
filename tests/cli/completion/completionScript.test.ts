import {describe, expect, test} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProgramContainer} from '@/cli/program';
import {completionScript, SHELLS} from '@/cli/completion/completionScript';
import {type CommandNode, CommandRegistry} from '@/cli/CommandRegistry';
import type {Io} from '@/cli/io';

const io: Io = {
    stdout() {},
    stderr() {},
    isTTY: false,
    env: {},
    progressOutput: process.stderr,
    prompts: {} as Io['prompts'],
};

const tree = createProgramContainer(io).resolve(CommandRegistry).tree();

function search(node: CommandNode, path: string): CommandNode | undefined {
    if (node.path === path) return node;
    for (const child of node.commands) {
        const found = search(child, path);
        if (found) return found;
    }
    return undefined;
}

function find(node: CommandNode, path: string): CommandNode {
    const found = search(node, path);
    if (!found) throw new Error(`no node ${path}`);
    return found;
}

function leaves(node: CommandNode): CommandNode[] {
    return node.commands.length ? node.commands.flatMap(leaves) : [node];
}

// The scripts embed argument choices unquoted (bash `compgen -W`, fish `-a`),
// so a choice with a space or shell metacharacter would break them.
test('every argument choice is a plain token', () => {
    const bad: string[] = [];
    const walk = (node: CommandNode): void => {
        for (const a of node.arguments)
            for (const c of a.choices ?? [])
                if (!/^[a-z0-9_.:-]+$/i.test(c))
                    bad.push(`${node.path}: ${a.name} = ${c}`);
        node.commands.forEach(walk);
    };
    walk(tree);
    expect(bad).toEqual([]);
});

test('find fails loudly for an unknown path', () => {
    expect(() => find(tree, 'no such command')).toThrow('no node');
});

const cacheClear = find(tree, 'cache clear');
const longFlags = cacheClear.options.map(
    (o) => /--[a-z0-9-]+/.exec(o.flags)![0],
);

/** Fish declares options as `-l name`; the others spell out `--name`. */
function mention(shell: string, flag: string): string {
    return shell === 'fish' ? `-l ${flag.slice(2)}` : flag;
}

describe.each(SHELLS)('%s completion script', (shell) => {
    const script = completionScript(shell, tree);

    test(`${shell} script mentions every leaf and every long flag of cache clear`, () => {
        for (const leaf of leaves(find(tree, 'cache')))
            expect(script).toContain(leaf.name);
        for (const flag of longFlags)
            expect(script).toContain(mention(shell, flag));
    });

    test(`${shell} script completes sites and environments dynamically`, () => {
        expect(script).toContain('kinstactl completion sites');
        expect(script).toContain('kinstactl completion envs');
        expect(script).toContain('2>/dev/null');
    });

    test(`${shell} script parses`, () => {
        const dir = mkdtempSync(join(tmpdir(), 'kinstactl-completion-'));
        const file = join(dir, `script.${shell}`);
        writeFileSync(file, script);
        const r = spawnSync(shell, ['-n', file], {encoding: 'utf8'});
        if ((r.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
            console.log(`${shell} not installed; skipping syntax check`);
            return;
        }
        expect({stderr: r.stderr, status: r.status}).toEqual({
            stderr: '',
            status: 0,
        });
    });

    test(`${shell} script completes environments by value placeholder, not flag name`, () => {
        const lineWith = (needle: string): string => {
            const line = script.split('\n').find((l) => l.includes(needle));
            if (!line) throw new Error(`no line with ${needle}`);
            return line;
        };
        if (shell === 'fish') {
            expect(lineWith('under "env push"').includes('-l from ')).toBe(
                true,
            );
            const push = script
                .split('\n')
                .find(
                    (l) =>
                        l.includes('under "env push"') &&
                        l.includes('-l from '),
                )!;
            const logs = script
                .split('\n')
                .find(
                    (l) => l.includes('under "logs"') && l.includes('-l from '),
                )!;
            expect(push).toContain('completion envs');
            expect(logs).not.toContain('completion envs');
            return;
        }
        expect(script).toContain("'env push:--from'");
        expect(script).not.toContain("'logs:--from'");
        expect(script).not.toContain("'analytics:--from'");
        expect(script).toContain("'backups restore:--from-env'");
    });

    test(`${shell} script resolves the site word at the site argument's position`, () => {
        // analytics <metric> [site]: site is the second positional;
        // env push <site>: the first.
        const needles: Record<string, [string, string]> = {
            zsh: ['positionals[2]', 'positionals[1]'],
            bash: ['positionals[1]', 'positionals[0]'],
            fish: ['__kinstactl_arg 3)', '__kinstactl_arg 3)'],
        };
        const [second, first] = needles[shell] as [string, string];
        const envLine = (path: string, flag: string): string => {
            const lines = script.split('\n');
            const i = lines.findIndex((l) =>
                shell === 'fish'
                    ? l.includes(`under "${path}"`) && l.includes(`-l ${flag} `)
                    : l.includes(`'${path}:--${flag}'`),
            );
            if (i < 0) throw new Error(`no env completion for ${path}`);
            if (shell === 'fish') return lines[i]!;
            // The arm runs from its pattern to the closing `;;`.
            const end = lines.findIndex((l, j) => j >= i && l.endsWith(';;'));
            return lines.slice(i, end + 1).join('\n');
        };
        const analytics = envLine('analytics', 'env');
        const push = envLine('env push', 'to');
        expect(analytics).toContain('completion envs');
        expect(analytics).toContain(second);
        expect(push).toContain(first);
        if (shell !== 'fish') {
            expect(analytics).not.toContain(first);
            expect(push).not.toContain(second);
        }
    });

    test(`${shell} script is unchanged`, () => {
        expect(script).toMatchSnapshot();
    });
});

test('zsh script defines _kinstactl and registers it', () => {
    const script = completionScript('zsh', tree);
    expect(script).toContain('_kinstactl()');
    expect(script.trimEnd().endsWith('compdef _kinstactl kinstactl')).toBe(
        true,
    );
    expect(script).toContain('$(kinstactl completion sites 2>/dev/null)');
    expect(script).toContain(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: zsh syntax
        '$(kinstactl completion envs ${positionals[1]} 2>/dev/null)',
    );
    expect(script).toContain('cache:Clear the caches of a site environment');
});

test('bash script uses COMP_WORDS, compgen and complete -F', () => {
    const script = completionScript('bash', tree);
    expect(script).toContain('COMP_WORDS');
    expect(script).toContain('COMP_CWORD');
    expect(script).toContain('compgen -W');
    expect(script.trimEnd().endsWith('complete -F _kinstactl kinstactl')).toBe(
        true,
    );
});

test('fish script starts with complete -c kinstactl -f and describes options', () => {
    const script = completionScript('fish', tree);
    expect(script.startsWith('complete -c kinstactl -f')).toBe(true);
    expect(script).toContain('__fish_seen_subcommand_from cache');
    expect(script).toContain('-l env -x');
    expect(script).toContain("-d 'environment name or ID'");
});

describe.each(SHELLS)(
    '%s completion of a leaf without a site argument',
    (shell) => {
        test('does not list environments', () => {
            const leaf: CommandNode = {
                name: 'orphan',
                path: 'orphan',
                description: 'leaf without a site argument',
                arguments: [],
                options: [
                    {flags: '--env <environment>', description: 'environment'},
                ],
                destructive: null,
                endpoints: [],
                commands: [],
            };
            const root: CommandNode = {
                name: 'kinstactl',
                path: '',
                description: 'root',
                arguments: [],
                options: [],
                destructive: null,
                endpoints: [],
                commands: [leaf],
            };
            expect(completionScript(shell, root)).not.toContain(
                'completion envs',
            );
        });
    },
);
