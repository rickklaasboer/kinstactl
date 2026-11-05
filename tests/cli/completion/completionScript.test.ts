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

function find(node: CommandNode, path: string): CommandNode {
    const found = [node, ...node.commands].find((n) => n.path === path);
    if (found) return found;
    for (const child of node.commands) {
        try {
            return find(child, path);
        } catch {}
    }
    throw new Error(`no node ${path}`);
}

function leaves(node: CommandNode): CommandNode[] {
    return node.commands.length ? node.commands.flatMap(leaves) : [node];
}

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
        '$(kinstactl completion envs ${site} 2>/dev/null)',
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
