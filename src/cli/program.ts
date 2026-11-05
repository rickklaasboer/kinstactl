import {Command, CommanderError} from 'commander';
import type {EndpointKey} from '@/client/request';
import {registerAuth} from './commands/auth';
import {registerBackups} from './commands/backups';
import {registerCache} from './commands/cache';
import {registerCommands} from './commands/commands';
import {registerEnv} from './commands/env';
import {registerLogs} from './commands/logs';
import {registerOperations} from './commands/operations';
import {registerPhp} from './commands/php';
import {registerPlugins} from './commands/plugins';
import {registerSites} from './commands/sites';
import {toCliError} from './errors';
import {Runtime, type Io} from './runtime';

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

export function buildProgram(rt: Runtime): Command {
    const program = new Command('kinstactl');
    program
        .description('Command line client for the Kinsta API')
        .exitOverride()
        .showSuggestionAfterError(true)
        .configureOutput({
            writeOut: (s) => rt.io.stdout(s),
            writeErr: (s) => rt.io.stderr(s),
            // Errors are rendered by run() through Output, in the right format for --json.
            outputError: () => {},
            getOutHasColors: () => rt.output.color,
            getErrHasColors: () => rt.output.color,
        })
        .option('--profile <name>', 'config profile to use')
        .option('--json', 'print machine-readable JSON')
        .option('--no-input', 'never prompt; fail instead')
        .hook('preAction', () => rt.configure(program.opts()));

    registerAuth(program, rt);
    registerCommands(program, rt);
    registerOperations(program, rt);
    registerLogs(program, rt);
    registerSites(program, rt);
    registerEnv(program, rt);
    registerCache(program, rt);
    registerPhp(program, rt);
    registerPlugins(program, rt);
    registerBackups(program, rt);
    return program;
}

function isEpipe(e: unknown): boolean {
    return (e as {code?: unknown} | null)?.code === 'EPIPE';
}

/** Runs the CLI and returns the exit code. */
export async function run(argv: string[], io: Io): Promise<number> {
    const rt = new Runtime(io);
    // Parse errors happen before the preAction hook, and must still honor --json.
    rt.json = argv.includes('--json');
    const program = buildProgram(rt);
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
        rt.output.error(err);
        return err.exitCode;
    }
}
