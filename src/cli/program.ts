import {Command, CommanderError} from 'commander';
import type {EndpointKey} from '@/client/request';
import type {DependencyContainer} from 'tsyringe';
import {
    CommandRegistry,
    GLOBAL_OPTIONS,
    ROOT_DESCRIPTION,
    toOption,
} from './CommandRegistry';
import type {BaseCommand, CommandClass} from './commands/BaseCommand';
import {COMMANDS, GROUPS, type LegacyEntry} from './commands/index';
import {createContainer} from './container';
import {toCliError} from './errors';
import {IO, type Io} from './io';
import {Output} from './output';
import {Runtime} from './runtime';
import {RunContext} from './services/RunContext';

export interface CommandMeta {
    endpoints: EndpointKey[];
    destructive?: 'confirm' | 'irreversible';
}

const metas = new WeakMap<Command, CommandMeta>();

/** Declares which API endpoints a command uses and whether it is destructive. */
export function meta(cmd: Command, m: CommandMeta): Command {
    metas.set(cmd, m);
    return cmd;
}

export function getMeta(cmd: Command): CommandMeta | undefined {
    return metas.get(cmd);
}

function isLegacy(entry: CommandClass | LegacyEntry): entry is LegacyEntry {
    return 'legacy' in entry;
}

export function createProgramContainer(io: Io): DependencyContainer {
    const container = createContainer(io);
    const classes = COMMANDS.filter(
        (entry): entry is CommandClass => !isLegacy(entry),
    );
    container.registerInstance(
        CommandRegistry,
        new CommandRegistry(container, classes, GROUPS),
    );
    return container;
}

export function buildProgram(container: DependencyContainer): Command {
    const rt = container.resolve(Runtime);
    const ctx = container.resolve(RunContext);
    const output = container.resolve(Output);
    const io = container.resolve<Io>(IO);
    const registry = container.resolve(CommandRegistry);
    const program = new Command('kinstactl');
    program
        .description(ROOT_DESCRIPTION)
        .exitOverride()
        .showSuggestionAfterError(true)
        .configureOutput({
            writeOut: (s) => io.stdout(s),
            writeErr: (s) => io.stderr(s),
            // Errors are rendered by run() through Output, in the right format for --json.
            outputError: () => {},
            getOutHasColors: () => output.color,
            getErrHasColors: () => output.color,
        });
    for (const def of GLOBAL_OPTIONS) program.addOption(toOption(def));
    program.hook('preAction', () => ctx.configure(program.opts()));

    const resolved = registry.commands();
    let next = 0;
    for (const entry of COMMANDS) {
        if (isLegacy(entry)) {
            entry.legacy(program, rt);
            continue;
        }
        const command = resolved[next++] as BaseCommand;
        meta(registry.attach(program, command), {
            endpoints: command.endpoints,
            destructive: command.destructive,
        });
    }
    return program;
}

function isEpipe(e: unknown): boolean {
    return (e as {code?: unknown} | null)?.code === 'EPIPE';
}

/** Runs the CLI and returns the exit code. */
export async function run(argv: string[], io: Io): Promise<number> {
    const container = createProgramContainer(io);
    // Parse errors happen before the preAction hook, and must still honor --json.
    container.resolve(RunContext).json = argv.includes('--json');
    const program = buildProgram(container);
    try {
        await program.parseAsync(argv, {from: 'user'});
        return 0;
    } catch (e) {
        if (isEpipe(e)) return 0;
        if (e instanceof CommanderError) {
            if (
                e.code === 'commander.helpDisplayed' ||
                e.code === 'commander.version'
            )
                return 0;
            // Help was already written to stderr because a subcommand was missing.
            if (e.code === 'commander.help') return 2;
        }
        const err = toCliError(e);
        container.resolve(Output).error(err);
        return err.exitCode;
    }
}
