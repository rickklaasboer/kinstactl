import {injectable} from 'tsyringe';
import {getSite} from '@/client/endpoints/sites';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type SiteResponse = components['schemas']['SiteById-Response'];

@injectable()
export class SitesGetCommand implements BaseCommand {
    readonly name = 'sites get';
    readonly description = 'Show the details of a site';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [];
    readonly examples = [
        'kinstactl sites get my-site',
        'kinstactl sites get my-site --json',
    ];
    readonly endpoints: EndpointKey[] = ['GET /sites', 'GET /sites/{site_id}'];

    constructor(
        private readonly output: Output,
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
    ) {}

    async execute(args: CommandArgs): Promise<void> {
        const ref = await this.resolver.resolveSite(args.site, {fresh: false});
        const {site} = await this.clients
            .client()
            .send<SiteResponse>(getSite(ref.id));
        this.output.data(site, () =>
            [
                ['Name', site.name],
                ['Display name', site.display_name],
                ['ID', site.id],
                ['Status', site.status],
                ['Company', site.company_id],
                [
                    'Environments',
                    site.environments.map((e) => e.name).join(', '),
                ],
            ]
                .map(([k, v]) => `${k!.padEnd(13)}${v}`)
                .join('\n'),
        );
    }
}
