import {Command, CommanderError} from 'commander';
import type {DependencyContainer} from 'tsyringe';
import {
    CommandRegistry,
    GLOBAL_OPTIONS,
    ROOT_DESCRIPTION,
    toOption,
} from './CommandRegistry';
import {COMMANDS, GROUPS} from './commands/index';
import {createContainer} from './container';
import {toCliError} from './errors';
import {IO, type Io} from './io';
import {Output} from './output';
import {RunContext} from './services/RunContext';

export function createProgramContainer(io: Io): DependencyContainer {
    const container = createContainer(io);
    container.registerInstance(
        CommandRegistry,
        new CommandRegistry(container, COMMANDS, GROUPS),
    );
    return container;
}

export function buildProgram(container: DependencyContainer): Command {
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

    for (const command of registry.commands()) {
        registry.attach(program, command);
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
