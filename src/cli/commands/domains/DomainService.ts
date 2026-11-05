import {Lifecycle, scoped} from 'tsyringe';
import {listSiteDomains} from '@/client/endpoints/domains';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../../errors';
import {ClientProvider} from '../../services/ClientProvider';
import type {EnvRef, SiteRef} from '../../services/SiteCache';
import {suggest} from '../../services/SiteResolver';

type Schemas = components['schemas'];
export type SiteDomain = Schemas['SiteDomain'];

/** Reads the domains of an environment and resolves one from user input. */
@scoped(Lifecycle.ContainerScoped)
export class DomainService {
    constructor(private readonly clients: ClientProvider) {}

    async list(envId: string): Promise<SiteDomain[]> {
        const res = await this.clients
            .client()
            .send<Schemas['GetSiteDomainsResponseSchema']>(
                listSiteDomains(envId),
            );
        return res.environment.site_domains;
    }

    /** Exact name (case-insensitive) or ID; else unambiguous prefix; otherwise USAGE with the candidate names. */
    async find(
        target: {site: SiteRef; env: EnvRef},
        input: string,
    ): Promise<SiteDomain> {
        const domains = await this.list(target.env.id);
        const needle = input.toLowerCase();
        const exact = domains.filter(
            (d) => d.id === input || d.name.toLowerCase() === needle,
        );
        if (exact.length === 1) return exact[0]!;
        const found =
            exact.length > 0
                ? exact
                : domains.filter((d) =>
                      d.name.toLowerCase().startsWith(needle),
                  );
        if (found.length === 1) return found[0]!;
        if (found.length > 1)
            throw new CliError(
                'USAGE',
                `"${input}" matches several domains of ${target.site.name} (${target.env.name})`,
                found.map((d) => d.name),
            );
        throw new CliError(
            'USAGE',
            `${target.site.name} (${target.env.name}) has no domain "${input}"`,
            suggest(
                input,
                domains.map((d) => d.name),
            ),
        );
    }
}
