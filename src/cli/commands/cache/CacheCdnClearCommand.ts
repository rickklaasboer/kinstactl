import {injectable} from 'tsyringe';
import {listEnvironments} from '@/client/endpoints/environments';
import {clearCdnCache} from '@/client/endpoints/tools';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {ClientProvider} from '../../services/ClientProvider';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type EnvironmentsResponse = components['schemas']['GetEnvironments-Response'];

type Options = {env?: string} & ActionFlags;

@injectable()
export class CacheCdnClearCommand implements BaseCommand<Options> {
    readonly name = 'cache cdn clear';
    readonly description = 'Clear the CDN cache of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({dryRun: true, wait: true}),
    ];
    readonly examples = [
        'kinstactl cache cdn clear klant-x --env live',
        'kinstactl cache cdn clear klant-x --env live --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites/{site_id}/environments',
        'POST /sites/cdn/clear-cache',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly clients: ClientProvider,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const res = await this.clients
            .client()
            .send<EnvironmentsResponse>(listEnvironments(target.site.id));
        const env = res.site.environments.find((e) => e.id === target.env.id);
        if (!env)
            throw new Error(
                `Environment ${target.env.id} missing from the environments of ${target.site.name}`,
            );
        if (env.cdn_cache_id === null)
            throw new CliError(
                'USAGE',
                `CDN is not enabled for ${target.site.name} (${target.env.name})`,
            );
        await this.operations.run({
            title: 'Clear CDN cache',
            spec: clearCdnCache(target.env.id, env.cdn_cache_id),
            target,
            flags: options,
        });
    }
}
