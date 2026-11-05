import {Argument, type Command, InvalidArgumentError, Option} from 'commander';
import {getLogs, type LogsOptions} from '@/client/endpoints/logs';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../errors';
import {meta} from '../program';
import {resolveTarget} from '../resolve';
import type {Runtime} from '../runtime';

const MAX_LINES = 20000;

const FILE_NAMES: Record<string, LogsOptions['fileName']> = {
    error: 'error',
    access: 'access',
    cache: 'kinsta-cache-perf',
};

function parseLines(v: string): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LINES)
        throw new InvalidArgumentError(
            `must be an integer between 1 and ${MAX_LINES}`,
        );
    return n;
}

export function registerLogs(program: Command, rt: Runtime): void {
    meta(
        program
            .command('logs')
            .description(
                'Read the error, access or cache log of an environment',
            )
            .argument('<site>', 'site name, display name or ID')
            .addArgument(
                new Argument('[type]', 'log type')
                    .choices(Object.keys(FILE_NAMES))
                    .default('error'),
            )
            .option('--env <environment>', 'environment name or ID')
            .addOption(
                new Option('--lines <n>', `number of lines (max ${MAX_LINES})`)
                    .argParser(parseLines)
                    .default(1000),
            )
            .option('--search <text>', 'only lines containing this text')
            .option('--from <datetime>', 'only lines from this date and time')
            .option('--to <datetime>', 'only lines up to this date and time')
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl logs klant-x --env live\n  $ kinstactl logs klant-x access --env live --lines 200 --search wp-login\n  $ kinstactl logs klant-x cache --env live --json',
            )
            .action(
                async (
                    siteInput: string,
                    type: string,
                    opts: {
                        env?: string;
                        lines: number;
                        search?: string;
                        from?: string;
                        to?: string;
                    },
                ) => {
                    const {site, env} = await resolveTarget(
                        rt,
                        siteInput,
                        opts.env,
                        {write: false},
                    );
                    const body = await rt
                        .client()
                        .send<components['schemas']['GetLogsResponseSchema']>(
                            getLogs(env.id, {
                                fileName: FILE_NAMES[type]!,
                                lines: opts.lines,
                                search: opts.search,
                                from: opts.from,
                                to: opts.to,
                            }),
                        );
                    const text = body?.environment?.container_info?.logs;
                    if (typeof text !== 'string')
                        throw new CliError(
                            'API_ERROR',
                            `Response has no log text for ${site.name} (${env.name})`,
                        );
                    rt.output.data(body, () => text.replace(/\n$/, ''));
                },
            ),
        {endpoints: ['GET /sites/environments/{env_id}/logs']},
    );
}
