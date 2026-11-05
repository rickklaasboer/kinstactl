import {Lifecycle, scoped} from 'tsyringe';
import {listDomains} from '@/client/endpoints/dns';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../../errors';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import {suggest} from '../../services/SiteResolver';

export type DnsZone = components['schemas']['Domain'];

/** Reads the DNS zones (domains) of the company and resolves user input to one. */
@scoped(Lifecycle.ContainerScoped)
export class DnsZoneService {
    constructor(
        private readonly clients: ClientProvider,
        private readonly config: ConfigService,
    ) {}

    async list(): Promise<DnsZone[]> {
        const res = await this.clients
            .client()
            .send<components['schemas']['CompanyDomainsSchema']>(
                listDomains(this.config.credentials().companyId),
            );
        return res.company.domains;
    }

    /** Exact name or ID first, then a unique prefix of the name; never a silent pick. */
    async find(input: string): Promise<DnsZone> {
        const zones = await this.list();
        const needle = input.toLowerCase();
        const exact = zones.filter(
            (z) =>
                z.id.toLowerCase() === needle ||
                z.name.toLowerCase() === needle,
        );
        const found =
            exact.length > 0
                ? exact
                : zones.filter((z) => z.name.toLowerCase().startsWith(needle));
        if (found.length === 1) return found[0]!;
        if (found.length > 1)
            throw new CliError(
                'USAGE',
                `Zone "${input}" matches several zones`,
                found.map((z) => z.name),
            );
        throw new CliError(
            'USAGE',
            `No zone matches "${input}"`,
            suggest(
                input,
                zones.map((z) => z.name),
            ),
        );
    }
}
