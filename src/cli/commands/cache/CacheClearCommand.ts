import {injectable} from 'tsyringe';
import {clearCache} from '@/client/endpoints/tools';
import type {EndpointKey} from '@/client/request';
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
export class CacheClearCommand implements BaseCommand<Options> {
    readonly name = 'cache clear';
    readonly description = 'Clear the site cache of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({dryRun: true, wait: true}),
    ];
    readonly examples = [
        'kinstactl cache clear my-site --env live',
        'kinstactl cache clear my-site --env staging --dry-run',
    ];
    readonly endpoints: EndpointKey[] = ['POST /sites/tools/clear-cache'];

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
        await this.operations.run({
            title: 'Clear cache',
            spec: clearCache(target.env.id),
            target,
            flags: options,
        });
    }
}
