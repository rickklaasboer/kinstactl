import type {Command} from 'commander';
import type {Operation} from '@/client/operations';
import {toOption} from './CommandRegistry';
import type {Destructive} from './commands/BaseCommand';
import type {Runtime} from './runtime';
import {actionOptions, type RunOperationArgs} from './services/OperationRunner';

export {
    type ActionFlags,
    parseMinutes,
    type RunOperationArgs,
} from './services/OperationRunner';

/** Adapters for code that predates OperationRunner. */
export function addActionFlags(
    cmd: Command,
    o: {dryRun?: boolean; wait?: boolean; destructive?: Destructive},
): Command {
    for (const option of actionOptions(o).map(toOption)) cmd.addOption(option);
    return cmd;
}

export function waitForOperation(
    rt: Runtime,
    op: Operation,
    title: string,
    timeoutMinutes?: number,
): Promise<void> {
    return rt.operations.wait(op, title, timeoutMinutes);
}

export function runOperation(
    rt: Runtime,
    args: RunOperationArgs,
): Promise<void> {
    return rt.operations.run(args);
}
