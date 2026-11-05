import {expect, test} from 'bun:test';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {type CommandNode, CommandRegistry} from '@/cli/CommandRegistry';
import type {Io} from '@/cli/io';
import {createProgramContainer} from '@/cli/program';

export const DOCS_DIR = 'docs/src/content/docs';

const STOP_TOKENS = ['|', '||', '&&', ';', '>', '2>', '#'];

/** Whitespace split that keeps "..." and '...' together; no escapes. */
export function shellSplit(line: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inToken = false;
    let quote: string | null = null;
    for (const char of line) {
        if (quote) {
            if (char === quote) quote = null;
            else current += char;
        } else if (char === '"' || char === "'") {
            quote = char;
            inToken = true;
        } else if (/\s/.test(char)) {
            if (inToken) tokens.push(current);
            current = '';
            inToken = false;
        } else {
            current += char;
            inToken = true;
        }
    }
    if (quote) throw new Error(`Unterminated quote in: ${line}`);
    if (inToken) tokens.push(current);
    return tokens;
}

/** Drops a trailing `# comment`, which may hold an unbalanced quote. */
function stripComment(text: string): string {
    return text.replace(/(^|\s)#.*$/, '');
}

/** Lines inside ``` fences that mention the `kinstactl` token. */
export function exampleLines(markdown: string): {line: number; text: string}[] {
    const found: {line: number; text: string}[] = [];
    let inFence = false;
    markdown.split('\n').forEach((text, i) => {
        if (text.trimStart().startsWith('```')) {
            inFence = !inFence;
            return;
        }
        if (
            inFence &&
            /\bkinstactl\b/.test(text) &&
            shellSplit(stripComment(text)).includes('kinstactl')
        ) {
            found.push({line: i + 1, text});
        }
    });
    return found;
}

/** The arguments after `kinstactl`, up to the first shell operator. */
export function commandTokens(text: string): string[] {
    const tokens = shellSplit(stripComment(text));
    const start = tokens.indexOf('kinstactl');
    if (start === -1) throw new Error(`No kinstactl token in: ${text}`);
    const rest = tokens.slice(start + 1);
    const stop = rest.findIndex((t) => STOP_TOKENS.includes(t));
    return stop === -1 ? rest : rest.slice(0, stop);
}

function longName(flags: string): string {
    return flags.split(/[ ,]/)[0] as string;
}

/** Null when the tokens are a valid invocation, else the reason. */
export function checkExample(
    tree: CommandNode,
    tokens: string[],
): string | null {
    let node = tree;
    let i = 0;
    while (i < tokens.length) {
        const child = node.commands.find((c) => c.name === tokens[i]);
        if (!child) break;
        node = child;
        i++;
    }
    const rest = tokens.slice(i);
    if (node.commands.length > 0) {
        const allowed =
            node === tree ? ['--help', '--version', '-V'] : ['--help'];
        if (rest.every((t) => allowed.includes(t))) return null;
        const next = rest[0] as string;
        return `"${next}" is not a command under "${node.path || 'kinstactl'}"`;
    }
    const known = new Set([
        '--help',
        ...node.options.map((o) => longName(o.flags)),
    ]);
    for (const token of rest) {
        if (!token.startsWith('--')) continue;
        const flag = token.split('=')[0] as string;
        if (!known.has(flag)) return `unknown flag ${flag} for "${node.path}"`;
    }
    return null;
}

function buildTree(): CommandNode {
    const io: Io = {
        stdout() {},
        stderr() {},
        isTTY: false,
        env: {},
        progressOutput: process.stderr,
        prompts: {} as Io['prompts'],
    };
    return createProgramContainer(io).resolve(CommandRegistry).tree();
}

function leafPaths(node: CommandNode): string[] {
    return node.commands.length === 0
        ? [node.path]
        : node.commands.flatMap(leafPaths);
}

function markdownFiles(dir: string): string[] {
    return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return markdownFiles(path);
        return /\.mdx?$/.test(entry.name) ? [path] : [];
    });
}

const tree = buildTree();

test('shellSplit keeps quoted arguments together', () => {
    expect(
        shellSplit('wp run klant-x --env live "plugin list --status=active"'),
    ).toEqual([
        'wp',
        'run',
        'klant-x',
        '--env',
        'live',
        'plugin list --status=active',
    ]);
});

test('commandTokens stops at a pipe', () => {
    expect(commandTokens('$ kinstactl sites list --json | jq .')).toEqual([
        'sites',
        'list',
        '--json',
    ]);
});

test('unbalanced apostrophes outside commands do not throw', () => {
    const markdown = [
        '```ts',
        "// don't touch this",
        '```',
        '```sh',
        "kinstactl sites list # don't",
        '```',
    ].join('\n');
    expect(exampleLines(markdown)).toEqual([
        {line: 5, text: "kinstactl sites list # don't"},
    ]);
    expect(commandTokens("kinstactl sites list # don't")).toEqual([
        'sites',
        'list',
    ]);
});

test('checkExample rejects an unknown flag and an unknown command', () => {
    expect(checkExample(tree, ['sites', 'list', '--jsn'])).toContain('--jsn');
    expect(checkExample(tree, ['site', 'list'])).not.toBeNull();
    expect(
        checkExample(tree, [
            'wp',
            'run',
            'klant-x',
            '--env',
            'live',
            'plugin list --status=active',
        ]),
    ).toBeNull();
    expect(checkExample(tree, ['--version'])).toBeNull();
});

test('every kinstactl example in the docs and the readme is a real command with real flags', () => {
    const files = [...markdownFiles(DOCS_DIR), 'README.md'];
    const failures: string[] = [];
    for (const file of files) {
        for (const {line, text} of exampleLines(readFileSync(file, 'utf8'))) {
            const reason = checkExample(tree, commandTokens(text));
            if (reason) failures.push(`${file}:${line}: ${reason}`);
        }
    }
    expect(failures).toEqual([]);
});

test('every CommandRef points at a command', () => {
    const leaves = new Set(leafPaths(tree));
    const unknown: string[] = [];
    for (const file of markdownFiles(DOCS_DIR).filter((f) =>
        f.endsWith('.mdx'),
    )) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(/<CommandRef path="([^"]+)"/g)) {
            const path = match[1] as string;
            if (!leaves.has(path)) unknown.push(`${file}: ${path}`);
        }
    }
    expect(unknown).toEqual([]);
});
