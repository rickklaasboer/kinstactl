import {injectable} from 'tsyringe';
import {deleteSite} from '@/client/endpoints/sites';
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

@injectable()
export class SitesDeleteCommand implements BaseCommand<ActionFlags> {
    readonly name = 'sites delete';
    readonly description = 'Delete a site with all its environments';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        ...actionOptions({destructive: 'irreversible'}),
    ];
    readonly examples = [
        'kinstactl sites delete my-site --confirm my-site',
        'kinstactl sites delete my-site --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'DELETE /sites/{site_id}',
    ];
    readonly destructive: Destructive = 'irreversible';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: ActionFlags): Promise<void> {
        const site = await this.resolver.resolveSite(args.site, {fresh: true});
        await this.operations.run({
            title: `Delete site ${site.name}`,
            spec: deleteSite(site.id),
            target: {site},
            flags: options,
            confirm: {action: 'Delete site', level: 'irreversible'},
        });
    }
}
