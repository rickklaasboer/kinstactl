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

@injectable()
export class CacheEdgeClearCommand implements BaseCommand {
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

    async execute(
        args: CommandArgs,
        options: Record<string, unknown>,
    ): Promise<void> {
        const opts = options as unknown as {
            env?: string;
            url?: string;
            subdirectories?: boolean;
        } & ActionFlags;
        const target = await this.resolver.resolveTarget(args.site, opts.env, {
            write: true,
        });
        await this.operations.run({
            title: 'Clear edge cache',
            spec: clearEdgeCache(target.env.id, {
                url: opts.url,
                clearSubdirectories: opts.subdirectories,
            }),
            target,
            flags: opts,
        });
    }
}
