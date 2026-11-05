import {injectable} from 'tsyringe';
import {deleteEnvironment} from '@/client/endpoints/environments';
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
    type Destructive,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type Options = {env?: string} & ActionFlags;

@injectable()
export class EnvDeleteCommand implements BaseCommand<Options> {
    readonly name = 'env delete';
    readonly description = 'Delete an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({destructive: 'irreversible'}),
    ];
    readonly examples = [
        'kinstactl env delete klant-x --env staging --confirm klant-x',
        'kinstactl env delete klant-x --env staging --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'DELETE /sites/environments/{env_id}',
    ];
    readonly destructive: Destructive = 'irreversible';

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
            title: `Delete environment ${target.env.name}`,
            spec: deleteEnvironment(target.env.id),
            target,
            flags: options,
            confirm: {
                action: `Delete environment ${target.env.name}`,
                level: 'irreversible',
            },
        });
    }
}
