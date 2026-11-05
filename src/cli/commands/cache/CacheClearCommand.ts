import {injectable} from 'tsyringe';
import {clearCache} from '@/client/endpoints/tools';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

@injectable()
export class CacheClearCommand implements BaseCommand {
    readonly name = 'cache clear';
    readonly description = 'Clear the site cache of an environment';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({dryRun: true, wait: true}),
    ];
    readonly examples = [
        'kinstactl cache clear klant-x --env live',
        'kinstactl cache clear klant-x --env staging --dry-run',
    ];
    readonly endpoints: BaseCommand['endpoints'] = [
        'POST /sites/tools/clear-cache',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(
        args: CommandArgs,
        options: Record<string, unknown>,
    ): Promise<void> {
        const opts = options as unknown as {env?: string} & ActionFlags;
        const target = await this.resolver.resolveTarget(args.site, opts.env, {
            write: true,
        });
        await this.operations.run({
            title: 'Clear cache',
            spec: clearCache(target.env.id),
            target,
            flags: opts,
        });
    }
}
