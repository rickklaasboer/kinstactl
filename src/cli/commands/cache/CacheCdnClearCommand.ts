import {injectable} from 'tsyringe';
import {clearCdnCache} from '@/client/endpoints/tools';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
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
        'kinstactl cache cdn clear my-site --env live',
        'kinstactl cache cdn clear my-site --env live --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites/{site_id}/environments',
        'POST /sites/cdn/clear-cache',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const env = await this.resolver.details(target);
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
