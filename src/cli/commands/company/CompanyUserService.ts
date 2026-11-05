import {Lifecycle, scoped} from 'tsyringe';
import {listCompanyUsers} from '@/client/endpoints/account';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../../errors';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import {match, suggest} from '../../services/SiteResolver';

export type CompanyUserEntry =
    components['schemas']['CompanyUsersResponseSchema']['company']['users'][number];

/** Reads the company users and resolves user input to one. */
@scoped(Lifecycle.ContainerScoped)
export class CompanyUserService {
    constructor(
        private readonly clients: ClientProvider,
        private readonly config: ConfigService,
    ) {}

    async list(): Promise<CompanyUserEntry[]> {
        const res = await this.clients
            .client()
            .send<components['schemas']['CompanyUsersResponseSchema']>(
                listCompanyUsers(this.config.credentials().companyId),
            );
        return res.company.users;
    }

    /** Exact email, ID or full name first, then a unique prefix; never a silent pick. */
    async find(input: string): Promise<CompanyUserEntry> {
        const users = await this.list();
        const found = match(input, users, (u) => [
            u.user.email,
            u.user.id,
            u.user.full_name ?? '',
        ]);
        if (found.length === 1) return found[0]!;
        if (found.length > 1)
            throw new CliError(
                'USAGE',
                `User "${input}" matches several users`,
                found.map((u) => u.user.email),
            );
        throw new CliError(
            'USAGE',
            `No user matches "${input}"`,
            suggest(
                input,
                users.map((u) => u.user.email),
            ),
        );
    }
}
