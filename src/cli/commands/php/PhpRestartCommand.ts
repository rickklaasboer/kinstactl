import {injectable} from 'tsyringe';
import {restartPhp} from '@/client/endpoints/tools';
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
export class PhpRestartCommand implements BaseCommand<Options> {
    readonly name = 'php restart';
    readonly description = 'Restart the PHP engine of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({dryRun: true, wait: true}),
    ];
    readonly examples = [
        'kinstactl php restart klant-x --env live',
        'kinstactl php restart klant-x --env live --dry-run',
    ];
    readonly endpoints: BaseCommand['endpoints'] = [
        'POST /sites/tools/restart-php',
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
            title: 'Restart PHP',
            spec: restartPhp(target.env.id),
            target,
            flags: options,
        });
    }
}
