import type {Command} from 'commander';
import {getOperation} from '@/client/endpoints/operations';
import {CliError} from '../errors';
import {parseMinutes, waitForOperation} from '../progress';
import {meta} from '../program';
import type {Runtime} from '../runtime';

export function registerOperations(program: Command, rt: Runtime): void {
    const operations = program
        .command('operations')
        .description('Inspect and follow long-running Kinsta operations');

    meta(
        operations
            .command('get')
            .description('Show the current status of an operation')
            .argument('<id>', 'operation ID')
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl operations get 0e7b2d61-example\n  $ kinstactl operations get 0e7b2d61-example --json',
            )
            .action(async (id: string) => {
                const res = await rt.client().raw(getOperation(id));
                const message = (res.body as {message?: unknown} | null)
                    ?.message;
                const text = typeof message === 'string' ? message : undefined;
                if (res.status === 200 || res.status === 202) {
                    const status = res.status === 200 ? 'completed' : 'pending';
                    rt.output.data(
                        {operation_id: id, status, message: text},
                        () => `${id}: ${status}${text ? ` (${text})` : ''}`,
                    );
                    return;
                }
                if (res.status === 404)
                    throw new CliError('USAGE', `operation not found: ${id}`);
                if (res.status === 500)
                    throw new CliError(
                        'OPERATION_FAILED',
                        text ?? 'Operation failed',
                        [`Operation: ${id}`],
                    );
                throw new CliError(
                    'API_ERROR',
                    text ?? `Unexpected operation status HTTP ${res.status}`,
                );
            }),
        {endpoints: ['GET /operations/{operation_id}']},
    );

    meta(
        operations
            .command('wait')
            .description('Wait until an operation has finished')
            .argument('<id>', 'operation ID')
            .option(
                '--timeout <minutes>',
                'give up waiting after this many minutes (default 30)',
                parseMinutes,
            )
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl operations wait 0e7b2d61-example\n  $ kinstactl operations wait 0e7b2d61-example --timeout 10',
            )
            .action(async (id: string, opts: {timeout?: number}) => {
                await waitForOperation(
                    rt,
                    rt.client().operation(id),
                    `Operation ${id}`,
                    opts.timeout,
                );
                rt.output.success(`Operation ${id} completed`, {
                    operation_id: id,
                    status: 'completed',
                });
            }),
        {endpoints: ['GET /operations/{operation_id}']},
    );
}
