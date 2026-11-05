import type {CommandNode} from '../CommandRegistry';

export type Shell = 'zsh' | 'bash' | 'fish';
export const SHELLS: readonly Shell[] = ['zsh', 'bash', 'fish'];

const SITES = 'kinstactl completion sites 2>/dev/null';
const FISH_ENVS = 'kinstactl completion envs (__kinstactl_arg %N) 2>/dev/null';

interface Flag {
    long: string;
    description: string;
    /** The value placeholder without brackets, absent for a switch. */
    value?: string;
}

interface Leaf {
    path: string;
    words: number;
    arguments: CommandNode['arguments'];
    /** Zero-based position of the argument named `site`, absent without one. */
    siteIndex?: number;
    /** Options of the leaf itself, without the global ones. */
    flags: Flag[];
}

interface Group {
    path: string;
    name: string;
    children: {name: string; description: string}[];
}

function parseFlag(option: {flags: string; description: string}): Flag {
    const long = /--[a-z0-9][a-z0-9-]*/.exec(option.flags)?.[0];
    if (!long) throw new Error(`No long flag in "${option.flags}"`);
    const value = /<([^>]+?)(\.\.\.)?>/.exec(option.flags)?.[1];
    return {
        long,
        description: option.description,
        ...(value !== undefined && {value}),
    };
}

/** Environment names are chosen by the value placeholder, never by the flag name. */
function completesEnvs(flag: Flag): boolean {
    return flag.value === 'environment' || flag.value === 'env';
}

function sh(text: string): string {
    return `'${text.replaceAll("'", "'\\''")}'`;
}

function fishQuote(text: string): string {
    return `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

interface Model {
    root: Flag[];
    groups: Group[];
    leaves: Leaf[];
}

function model(tree: CommandNode): Model {
    const root = tree.options.map(parseFlag);
    const rootLongs = new Set(root.map((f) => f.long));
    const groups: Group[] = [];
    const leaves: Leaf[] = [];
    const walk = (node: CommandNode): void => {
        if (node.commands.length > 0) {
            groups.push({
                path: node.path,
                name: node.name,
                children: node.commands.map((c) => ({
                    name: c.name,
                    description: c.description,
                })),
            });
            node.commands.forEach(walk);
            return;
        }
        const siteIndex = node.arguments.findIndex((a) => a.name === 'site');
        leaves.push({
            path: node.path,
            words: node.path.split(' ').length,
            arguments: node.arguments,
            ...(siteIndex >= 0 && {siteIndex}),
            flags: node.options
                .map(parseFlag)
                .filter((f) => !rootLongs.has(f.long)),
        });
    };
    walk(tree);
    return {root, groups, leaves};
}

/** Flags that take a value, for the leaf plus the global ones. */
function valueFlags(flags: Flag[]): string[] {
    return flags.filter((f) => f.value !== undefined).map((f) => f.long);
}

function arms(entries: {pattern: string; body: string}[]): string {
    return entries
        .map((e) => `        ${e.pattern})\n            ${e.body} ;;`)
        .join('\n');
}

/** `case` arms shared by zsh and bash: one per path, fixed `*` fallback last. */
function pathArms(
    paths: {path: string; body: string}[],
    fallback: string,
): string {
    return `${arms(paths.map((p) => ({pattern: sh(p.path), body: p.body})))}\n        *)\n            ${fallback} ;;`;
}

/**
 * One arm per leaf with an environment option and a `site` argument; `site`
 * is read from the positionals the script collected, at its own position. A
 * leaf without a `site` argument has no site to list environments of.
 */
function envArms(m: Model, body: (siteIndex: number) => string): string {
    return arms(
        m.leaves.flatMap((l) => {
            const patterns = l.flags
                .filter(completesEnvs)
                .map((f) => sh(`${l.path}:${f.long}`));
            if (patterns.length === 0 || l.siteIndex === undefined) return [];
            return [
                {
                    pattern: patterns.join('|\\\n        '),
                    body: body(l.siteIndex),
                },
            ];
        }),
    );
}

function zshScript(m: Model): string {
    const children = m.groups.map((g) => ({
        path: g.path,
        body: `reply=(\n${g.children
            .map(
                (c) =>
                    `            ${sh(`${c.name.replaceAll(':', '\\:')}:${c.description}`)}`,
            )
            .join('\n')}\n            )`,
    }));
    const rootValue = valueFlags(m.root).join(' ');
    const valueArms = m.leaves
        .filter((l) => l.flags.some((f) => f.value !== undefined))
        .map((l) => ({
            path: l.path,
            body: `reply=(${[...valueFlags(l.flags), ...valueFlags(m.root)].join(' ')})`,
        }));
    const describe = (flags: Flag[]) =>
        `reply=(${flags
            .map((f) => sh(`${f.long}:${f.description}`))
            .join(' ')})`;
    const optionArms = m.leaves
        .filter((l) => l.flags.length > 0)
        .map((l) => ({
            path: l.path,
            body: describe([...l.flags, ...m.root]),
        }));
    const argumentArms = m.leaves.flatMap((l) =>
        l.arguments.map((a, i) => ({
            pattern: sh(`${l.path}:${i + 1}`),
            body: a.choices
                ? `compadd -- ${a.choices.map(sh).join(' ')}`
                : a.name === 'site'
                  ? `compadd -- $(${SITES})`
                  : `_message ${sh(a.name)}`,
        })),
    );
    // zsh arrays are one-based; `positionals` is local to `_kinstactl`.
    const envs = envArms(
        m,
        (i) =>
            `compadd -- $(kinstactl completion envs \${positionals[${i + 1}]} 2>/dev/null)`,
    );
    return `#compdef kinstactl
# zsh completion for kinstactl, generated by \`kinstactl completion zsh\`.

_kinstactl_children() {
    case $1 in
${pathArms(children, 'reply=()')}
    esac
}

_kinstactl_valueflags() {
    case $1 in
${pathArms(valueArms, `reply=(${rootValue})`)}
    esac
}

_kinstactl_options() {
    case $1 in
${pathArms(optionArms, describe(m.root))}
    esac
}

_kinstactl_argument() {
    case "$1:$2" in
${arms(argumentArms)}
        *)
            return 1 ;;
    esac
}

_kinstactl_value() {
    case "$1:$2" in
${envs}
        *)
            _message 'value' ;;
    esac
}

_kinstactl() {
    local cmdpath='' word prev i
    local -a reply positionals kids flags
    for (( i = 2; i < CURRENT; i++ )); do
        word=\${words[i]}
        _kinstactl_children "$cmdpath"
        kids=(\${reply%%:*})
        _kinstactl_valueflags "$cmdpath"
        flags=($reply)
        if [[ $word == -* ]]; then
            if (( \${flags[(Ie)$word]} )); then (( i++ )); fi
        elif (( $#kids )); then
            if (( \${kids[(Ie)$word]} )); then cmdpath=\${cmdpath:+$cmdpath }$word; fi
        else
            positionals+=($word)
        fi
    done
    prev=\${words[CURRENT-1]}
    _kinstactl_valueflags "$cmdpath"
    if (( \${reply[(Ie)$prev]} )); then
        _kinstactl_value "$cmdpath" "$prev"
        return
    fi
    _kinstactl_children "$cmdpath"
    kids=($reply)
    if [[ $PREFIX == -* ]]; then
        _kinstactl_options "$cmdpath"
        _describe -t options option reply
    elif (( $#kids )); then
        _describe -t commands command kids
    else
        _kinstactl_argument "$cmdpath" $(( $#positionals + 1 ))
    fi
}

if [[ $funcstack[1] == _kinstactl ]]; then
    _kinstactl "$@"
fi
compdef _kinstactl kinstactl
`;
}

function bashScript(m: Model): string {
    const children = m.groups.map((g) => ({
        path: g.path,
        body: `echo ${sh(g.children.map((c) => c.name).join(' '))}`,
    }));
    const rootValue = valueFlags(m.root).join(' ');
    const valueArms = m.leaves
        .filter((l) => l.flags.some((f) => f.value !== undefined))
        .map((l) => ({
            path: l.path,
            body: `echo ${sh([...valueFlags(l.flags), ...valueFlags(m.root)].join(' '))}`,
        }));
    const names = (flags: Flag[]) =>
        `echo ${sh(flags.map((f) => f.long).join(' '))}`;
    const optionArms = m.leaves
        .filter((l) => l.flags.length > 0)
        .map((l) => ({path: l.path, body: names([...l.flags, ...m.root])}));
    const words = (list: string) => `compgen -W "${list}" -- "$cur"`;
    const argumentArms = m.leaves.flatMap((l) =>
        l.arguments.map((a, i) => ({
            pattern: sh(`${l.path}:${i + 1}`),
            body: a.choices
                ? `COMPREPLY=($(${words(a.choices.join(' '))}))`
                : a.name === 'site'
                  ? `COMPREPLY=($(${words(`$(${SITES})`)}))`
                  : 'COMPREPLY=()',
        })),
    );
    // `positionals` is local to `_kinstactl`.
    const envs = envArms(
        m,
        (i) =>
            `COMPREPLY=($(${words(`$(kinstactl completion envs \${positionals[${i}]} 2>/dev/null)`)}))`,
    );
    return `# bash completion for kinstactl, generated by \`kinstactl completion bash\`.

_kinstactl_children() {
    case $1 in
${pathArms(children, 'echo')}
    esac
}

_kinstactl_valueflags() {
    case $1 in
${pathArms(valueArms, `echo ${sh(rootValue)}`)}
    esac
}

_kinstactl_options() {
    case $1 in
${pathArms(optionArms, names(m.root))}
    esac
}

_kinstactl_argument() {
    case "$1:$2" in
${arms(argumentArms)}
    esac
}

_kinstactl_value() {
    case "$1:$2" in
${envs}
    esac
}

_kinstactl() {
    local cur prev cmdpath='' word i kids flags
    local -a positionals=()
    cur=\${COMP_WORDS[COMP_CWORD]}
    prev=\${COMP_WORDS[COMP_CWORD-1]}
    COMPREPLY=()
    for ((i = 1; i < COMP_CWORD; i++)); do
        word=\${COMP_WORDS[i]}
        kids=$(_kinstactl_children "$cmdpath")
        flags=$(_kinstactl_valueflags "$cmdpath")
        if [[ $word == -* ]]; then
            if [[ " $flags " == *" $word "* ]]; then ((i++)); fi
        elif [[ -n $kids ]]; then
            if [[ " $kids " == *" $word "* ]]; then cmdpath=\${cmdpath:+$cmdpath }$word; fi
        else
            positionals+=("$word")
        fi
    done
    flags=$(_kinstactl_valueflags "$cmdpath")
    if [[ " $flags " == *" $prev "* ]]; then
        _kinstactl_value "$cmdpath" "$prev"
        return
    fi
    kids=$(_kinstactl_children "$cmdpath")
    if [[ $cur == -* ]]; then
        COMPREPLY=($(${words('$(_kinstactl_options "$cmdpath")')}))
    elif [[ -n $kids ]]; then
        COMPREPLY=($(${words('$kids')}))
    else
        _kinstactl_argument "$cmdpath" $((\${#positionals[@]} + 1))
    fi
}

complete -F _kinstactl kinstactl
`;
}

function fishScript(m: Model): string {
    const lines: string[] = [];
    const allValueFlags = [
        ...new Set([
            ...valueFlags(m.root),
            ...m.leaves.flatMap((l) => valueFlags(l.flags)),
        ]),
    ];
    const complete = (condition: string | undefined, rest: string) =>
        lines.push(
            `complete -c kinstactl${condition ? ` -n ${fishQuote(condition)}` : ''} ${rest}`,
        );

    for (const f of m.root)
        complete(
            undefined,
            `-l ${f.long.slice(2)}${f.value !== undefined ? ' -r' : ''} -d ${fishQuote(f.description)}`,
        );
    for (const g of m.groups) {
        const condition =
            g.path === ''
                ? "__kinstactl_at ''"
                : `__fish_seen_subcommand_from ${g.name}; and __kinstactl_at '${g.path}'`;
        for (const c of g.children)
            complete(
                condition,
                `-a ${fishQuote(c.name)} -d ${fishQuote(c.description)}`,
            );
    }
    for (const l of m.leaves) {
        const under = `__kinstactl_under "${l.path}"`;
        for (const f of l.flags) {
            const name = f.long.slice(2);
            const description = `-d ${fishQuote(f.description)}`;
            if (completesEnvs(f) && l.siteIndex !== undefined)
                complete(
                    under,
                    `-l ${name} -x -a ${fishQuote(`(${FISH_ENVS.replace('%N', String(l.words + l.siteIndex + 1))})`)} ${description}`,
                );
            else if (f.value !== undefined)
                complete(under, `-l ${name} -r ${description}`);
            else complete(under, `-l ${name} ${description}`);
        }
        l.arguments.forEach((a, i) => {
            const at = `__kinstactl_at_arg "${l.path}" ${i + 1}`;
            if (a.choices) complete(at, `-a ${fishQuote(a.choices.join(' '))}`);
            else if (a.name === 'site')
                complete(at, `-a ${fishQuote(`(${SITES})`)}`);
        });
    }

    return `complete -c kinstactl -f
# fish completion for kinstactl, generated by \`kinstactl completion fish\`.

# The words of the current line that are not options or option values.
function __kinstactl_path
    set -l tokens (commandline -opc)
    set -e tokens[1]
    set -l skip 0
    for token in $tokens
        if test $skip -eq 1
            set skip 0
            continue
        end
        if contains -- $token ${allValueFlags.join(' ')}
            set skip 1
        else if not string match -q -- '-*' $token
            echo $token
        end
    end
end

# The Nth word of the path, for the site argument of a leaf.
function __kinstactl_arg
    set -l path (__kinstactl_path)
    echo $path[$argv[1]]
end

function __kinstactl_at
    set -l path (__kinstactl_path)
    test "$path" = "$argv[1]"
end

function __kinstactl_under
    set -l path (__kinstactl_path)
    set -l n (count (string split ' ' -- $argv[1]))
    test (count $path) -ge $n; and test "$path[1..$n]" = "$argv[1]"
end

function __kinstactl_at_arg
    set -l path (__kinstactl_path)
    set -l n (count (string split ' ' -- $argv[1]))
    test (count $path) -eq (math $n + $argv[2] - 1); and test "$path[1..$n]" = "$argv[1]"
end

${lines.join('\n')}
`;
}

/**
 * A complete script for `shell`, built from the command tree: every group and
 * leaf, every long option (with a value placeholder when the flag takes one),
 * argument choices, and dynamic site and environment names through
 * `kinstactl completion sites` and `kinstactl completion envs <site>`.
 */
export function completionScript(shell: Shell, tree: CommandNode): string {
    const m = model(tree);
    switch (shell) {
        case 'zsh':
            return zshScript(m);
        case 'bash':
            return bashScript(m);
        case 'fish':
            return fishScript(m);
    }
}
