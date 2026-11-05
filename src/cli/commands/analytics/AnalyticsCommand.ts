import {InvalidArgumentError} from 'commander';
import {injectable} from 'tsyringe';
import {
    type AnalyticsQuery,
    diskspaceAnalytics,
    ENDPOINTS,
    environmentAnalytics,
    TIME_ZONE_PATTERN,
} from '@/client/endpoints/analytics';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import {RunContext} from '../../services/RunContext';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';
import {localTimeZone, METRICS, SPANS} from './metrics';
import {renderAnalytics} from './render';

type SpanKey = keyof typeof SPANS;

type Options = {
    env?: string;
    span: SpanKey;
    from?: string;
    to?: string;
    timeZone?: string;
};

function parseSpan(v: string): SpanKey {
    if (!Object.hasOwn(SPANS, v))
        throw new InvalidArgumentError(
            `must be one of ${Object.keys(SPANS).join(', ')}`,
        );
    return v as SpanKey;
}

function parseTimeZone(v: string): string {
    if (!TIME_ZONE_PATTERN.test(v))
        throw new InvalidArgumentError(
            'must be a whole-hour UTC offset such as 02:00 or -05:00',
        );
    return v;
}

@injectable()
export class AnalyticsCommand implements BaseCommand<Options> {
    readonly name = 'analytics';
    readonly description =
        'Traffic, bandwidth, disk and bot analytics of an environment';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'metric',
            required: true,
            description: `metric: ${METRICS.map((m) => m.name).join(', ')}`,
            choices: METRICS.map((m) => m.name),
        },
        siteArgument(),
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--span <span>',
            description: `time span: ${Object.keys(SPANS).join(', ')}`,
            parse: parseSpan,
            default: '7d',
        },
        {
            flags: '--from <date>',
            description: 'start date (instead of --span)',
        },
        {flags: '--to <date>', description: 'end date'},
        {
            flags: '--time-zone <offset>',
            description:
                'UTC offset for diskspace, e.g. 02:00 (default: local time zone)',
            parse: parseTimeZone,
        },
    ];
    readonly examples = [
        'kinstactl analytics visits klant-x --env live',
        'kinstactl analytics top-countries klant-x --env live --span 30d',
        'kinstactl analytics diskspace klant-x --env live --time-zone 02:00',
        'kinstactl analytics bot-traffic-flow klant-x --env live --json',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        ...ENDPOINTS.filter((e) => e.includes('/analytics/')),
    ];

    constructor(
        private readonly clients: ClientProvider,
        private readonly resolver: SiteResolver,
        private readonly config: ConfigService,
        private readonly ctx: RunContext,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const metric = METRICS.find((m) => m.name === args.metric);
        if (!metric)
            throw new CliError('USAGE', `Unknown metric ${args.metric}`);
        if (options.timeZone !== undefined && metric.path !== 'diskspace')
            throw new CliError(
                'USAGE',
                '--time-zone only applies to the diskspace metric',
            );
        if (metric.path === 'diskspace' && options.span === '24h')
            throw new CliError(
                'USAGE',
                'disk space analytics have no 24h span; use 7d, 30d or 60d',
            );

        const {env} = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const {companyId} = this.config.credentials();
        const query: AnalyticsQuery = {
            timeSpan: SPANS[options.span],
            from: options.from,
            to: options.to,
        };
        const spec =
            metric.path === 'diskspace'
                ? diskspaceAnalytics(env.id, companyId, {
                      ...query,
                      timeZone:
                          options.timeZone ??
                          localTimeZone(new Date(this.ctx.now())),
                  })
                : environmentAnalytics(env.id, companyId, metric.path, query);
        const body = await this.clients.client().send<unknown>(spec);
        if (this.output.json) {
            this.output.data(body, () => '');
            return;
        }
        renderAnalytics(
            metric.shape,
            body,
            this.output.table.bind(this.output),
            (text) => this.output.data(null, () => text),
        );
    }
}
