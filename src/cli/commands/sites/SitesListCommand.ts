import {injectable} from 'tsyringe';
import {listSites} from '@/client/endpoints/sites';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteCache} from '../../services/SiteCache';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

type ListResponse = components['schemas']['getSites-Response'];

type Options = {refresh?: boolean};

@injectable()
export class SitesListCommand implements BaseCommand<Options> {
    readonly name = 'sites list';
    readonly description = 'List the sites of the company';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [
        {flags: '--refresh', description: 'bypass the local site cache'},
    ];
    readonly examples = [
        'kinstactl sites list',
        'kinstactl sites list --refresh',
        'kinstactl sites list --json',
    ];
    readonly endpoints: EndpointKey[] = ['GET /sites'];

    constructor(
        private readonly output: Output,
        private readonly sites: SiteCache,
        private readonly clients: ClientProvider,
    ) {}

    async execute(_args: CommandArgs, options: Options): Promise<void> {
        if (this.output.json) {
            // JSON is the raw API array, which the site cache does not hold.
            const client = this.clients.client();
            const res = await client.send<ListResponse>(
                listSites(client.companyId, {includeEnvironments: true}),
            );
            this.output.table(res.company.sites, [], res.company.sites);
            return;
        }
        const rows = await this.sites.load({fresh: options.refresh === true});
        this.output.table(rows, [
            {header: 'NAME', value: (s) => s.name},
            {header: 'DISPLAY NAME', value: (s) => s.displayName},
            {
                header: 'ENVIRONMENTS',
                value: (s) => s.environments.map((e) => e.name).join(', '),
            },
            {header: 'ID', value: (s) => s.id},
        ]);
    }
}
