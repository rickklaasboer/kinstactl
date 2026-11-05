import {injectable} from 'tsyringe';
import {SITE_ROLES, setSiteRoles} from '@/client/endpoints/account';
import type {SiteRole} from '@/client/endpoints/account';
import {operationIdOf} from '@/client/operations';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ConfigService} from '../../services/ConfigService';
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
import {CompanyUserService} from './CompanyUserService';

type Options = ActionFlags;

@injectable()
export class CompanyUsersSiteRoleCommand implements BaseCommand<Options> {
    readonly name = 'company users site-role';
    readonly description = 'Set the role of a user on one site';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'user',
            required: true,
            description: 'email, full name or ID, see: company users list',
        },
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'role',
            required: true,
            description: 'site role',
            choices: SITE_ROLES,
        },
    ];
    readonly options: OptionDef[] = [...actionOptions({})];
    readonly examples = [
        'kinstactl company users site-role jan@example.com klant-x site-developer',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /company/{id}/users',
        'GET /sites',
        'POST /company/{company_id}/users/site-capabilities',
    ];

    constructor(
        private readonly users: CompanyUserService,
        private readonly resolver: SiteResolver,
        private readonly config: ConfigService,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const user = await this.users.find(args.user as string);
        const site = await this.resolver.resolveSite(args.site, {fresh: true});
        const role = args.role as SiteRole;
        const email = user.user.email;
        const body = await this.operations.send<unknown>({
            title: `Set ${email} to ${role} on ${site.name}`,
            spec: setSiteRoles(
                this.config.credentials().companyId,
                [user.user.id],
                [{siteId: site.id, role}],
            ),
            flags: options,
        });
        if (body === undefined) return;
        const operationId = operationIdOf(body);
        this.output.success(`${email} is now ${role} on ${site.name}`, {
            user_id: user.user.id,
            site_id: site.id,
            role,
            ...(operationId !== null && {operation_id: operationId}),
            status: 'completed',
        });
    }
}
