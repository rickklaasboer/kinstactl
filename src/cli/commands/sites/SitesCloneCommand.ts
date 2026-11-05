import {injectable} from 'tsyringe';
import {cloneSite} from '@/client/endpoints/sites';
import type {EndpointKey} from '@/client/request';
import {ClientProvider} from '../../services/ClientProvider';
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

type Options = {env?: string} & ActionFlags;

@injectable()
export class SitesCloneCommand implements BaseCommand<Options> {
    readonly name = 'sites clone';
    readonly description = 'Clone an environment of a site into a new site';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'display-name',
            required: true,
            description: 'display name of the new site',
        },
    ];
    readonly options: OptionDef[] = [
        {
            flags: '--env <environment>',
            description: 'environment to clone (default: the only one)',
        },
        ...actionOptions({}),
    ];
    readonly examples = ['kinstactl sites clone klant-x "Klant Y" --env live'];
    readonly endpoints: EndpointKey[] = ['GET /sites', 'POST /sites/clone'];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const displayName = args.displayName as string;
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        await this.operations.run({
            title: `Clone ${target.site.name} (${target.env.name}) to ${displayName}`,
            spec: cloneSite(
                this.clients.client().companyId,
                displayName,
                target.env.id,
            ),
            target,
            flags: options,
        });
    }
}
