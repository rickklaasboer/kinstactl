import {InvalidArgumentError} from 'commander';
import {injectable} from 'tsyringe';
import {getLogs, type LogsOptions} from '@/client/endpoints/logs';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

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

type Options = {
    env?: string;
    lines: number;
    search?: string;
    from?: string;
    to?: string;
};

@injectable()
export class LogsCommand implements BaseCommand<Options> {
    readonly name = 'logs';
    readonly description =
        'Read the error, access or cache log of an environment';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'type',
            required: false,
            description: 'log type',
            choices: Object.keys(FILE_NAMES),
            default: 'error',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--lines <n>',
            description: `number of lines (max ${MAX_LINES})`,
            parse: parseLines,
            default: 1000,
        },
        {
            flags: '--search <text>',
            description: 'only lines containing this text',
        },
        {
            flags: '--from <datetime>',
            description: 'only lines from this date and time',
        },
        {
            flags: '--to <datetime>',
            description: 'only lines up to this date and time',
        },
    ];
    readonly examples = [
        'kinstactl logs klant-x --env live',
        'kinstactl logs klant-x access --env live --lines 200 --search wp-login',
        'kinstactl logs klant-x cache --env live --json',
    ];
    readonly endpoints = ['GET /sites/environments/{env_id}/logs' as const];

    constructor(
        private readonly clients: ClientProvider,
        private readonly resolver: SiteResolver,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const {site, env} = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const body = await this.clients
            .client()
            .send<components['schemas']['GetLogsResponseSchema']>(
                getLogs(env.id, {
                    fileName: FILE_NAMES[args.type as string]!,
                    lines: options.lines,
                    search: options.search,
                    from: options.from,
                    to: options.to,
                }),
            );
        const text = body?.environment?.container_info?.logs;
        if (typeof text !== 'string')
            throw new CliError(
                'API_ERROR',
                `Response has no log text for ${site.name} (${env.name})`,
            );
        this.output.data(body, () => text.replace(/\n$/, ''));
    }
}
