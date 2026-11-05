import {injectable} from 'tsyringe';
import {
    bandwidthUsage,
    cdnBandwidthUsage,
    visitsUsage,
} from '@/client/endpoints/analytics';
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

type Schemas = components['schemas'];

@injectable()
export class SitesUsageCommand implements BaseCommand {
    readonly name = 'sites usage';
    readonly description =
        'Visits, bandwidth and CDN bandwidth of a site this month';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [];
    readonly examples = [
        'kinstactl sites usage klant-x',
        'kinstactl sites usage klant-x --json',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/{site_id}/usage/visits/this-month',
        'GET /sites/{site_id}/usage/bandwidth/this-month',
        'GET /sites/{site_id}/usage/cdn-bandwidth/this-month',
    ];

    constructor(
        private readonly clients: ClientProvider,
        private readonly resolver: SiteResolver,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs): Promise<void> {
        const site = await this.resolver.resolveSite(args.site, {
            fresh: false,
        });
        const client = this.clients.client();
        const visits = await client.send<Schemas['GetVisitsResponse']>(
            visitsUsage(site.id),
        );
        const bandwidth = await client.send<Schemas['GetBandwidthResponse']>(
            bandwidthUsage(site.id),
        );
        const cdn = await client.send<Schemas['GetCdnBandwidthResponse']>(
            cdnBandwidthUsage(site.id),
        );
        const result = {
            site: site.name,
            visits: visits.site.this_month_usage.visits,
            bandwidth: bandwidth.site.this_month_usage.bandwidth,
            cdn_bandwidth: cdn.site.this_month_cdn_usage.bandwidth,
        };
        this.output.data(
            result,
            () =>
                `Visits         ${result.visits}\nBandwidth      ${result.bandwidth}\nCDN bandwidth  ${result.cdn_bandwidth}`,
        );
    }
}
