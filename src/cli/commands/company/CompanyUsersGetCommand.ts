import {injectable} from 'tsyringe';
import {getCompanyUser} from '@/client/endpoints/account';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import {renderTable} from '../../table';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';
import {CompanyUserService} from './CompanyUserService';

@injectable()
export class CompanyUsersGetCommand implements BaseCommand<object> {
    readonly name = 'company users get';
    readonly description = 'Show a company user and the roles they hold';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'user',
            required: true,
            description: 'email, full name or ID, see: company users list',
        },
    ];
    readonly options: OptionDef[] = [];
    readonly examples = ['kinstactl company users get jan@example.com'];
    readonly endpoints: EndpointKey[] = [
        'GET /company/{id}/users',
        'GET /company/{id}/users/{id_user}',
    ];

    constructor(
        private readonly users: CompanyUserService,
        private readonly clients: ClientProvider,
        private readonly config: ConfigService,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, _options: object): Promise<void> {
        const found = await this.users.find(args.user as string);
        const res = await this.clients
            .client()
            .send<components['schemas']['CompanyUserByIdResponseSchema']>(
                getCompanyUser(
                    this.config.credentials().companyId,
                    found.user.id,
                ),
            );
        const {user, capabilities} = res.company.user_by_id;
        this.output.data(res, () =>
            [
                `Email: ${user.email}`,
                `Name:  ${user.full_name}`,
                `2FA:   ${user.type_2fa ?? 'off'}`,
                '',
                renderTable(
                    ['ROLE', 'COMPANY', 'SITE'],
                    capabilities.map((c) => [
                        c.role,
                        c.id_company ?? '',
                        c.id_site ?? '',
                    ]),
                ),
            ].join('\n'),
        );
    }
}
