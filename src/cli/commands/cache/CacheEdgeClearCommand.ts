import {injectable} from 'tsyringe';
import {clearEdgeCache} from '@/client/endpoints/tools';
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

type Options = {
    env?: string;
    url?: string;
    subdirectories?: boolean;
} & ActionFlags;

@injectable()
export class CacheEdgeClearCommand implements BaseCommand<Options> {
    readonly name = 'cache edge clear';
    readonly description = 'Clear the edge cache of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {flags: '--url <url>', description: 'clear only this URL'},
        {
            flags: '--subdirectories',
            description: 'also clear the subdirectories of --url',
        },
        ...actionOptions({dryRun: true, wait: true}),
    ];
    readonly examples = [
        'kinstactl cache edge clear klant-x --env live',
        'kinstactl cache edge clear klant-x --env live --url https://example.com/blog/ --subdirectories',
    ];
    readonly endpoints: BaseCommand['endpoints'] = [
        'POST /sites/edge-caching/clear',
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
        await this.operations.run({
            title: 'Clear edge cache',
            spec: clearEdgeCache(target.env.id, {
                url: options.url,
                clearSubdirectories: options.subdirectories,
            }),
            target,
            flags: options,
        });
    }
}
