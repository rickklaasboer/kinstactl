import {injectable} from 'tsyringe';
import {COMPANY_ROLES, setCompanyRole} from '@/client/endpoints/account';
import type {CompanyRole} from '@/client/endpoints/account';
import {operationIdOf} from '@/client/operations';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ConfigService} from '../../services/ConfigService';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';
import {CompanyUserService} from './CompanyUserService';

type Options = ActionFlags;

@injectable()
export class CompanyUsersRoleCommand implements BaseCommand<Options> {
    readonly name = 'company users role';
    readonly description = 'Set the company-wide role of a user';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'user',
            required: true,
            description: 'email, full name or ID, see: company users list',
        },
        {
            name: 'role',
            required: true,
            description: 'company role',
            choices: COMPANY_ROLES,
        },
    ];
    readonly options: OptionDef[] = [...actionOptions({})];
    readonly examples = [
        'kinstactl company users role jan@example.com company-developer',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /company/{id}/users',
        'POST /company/{company_id}/users/company-capabilities',
    ];

    constructor(
        private readonly users: CompanyUserService,
        private readonly config: ConfigService,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const found = await this.users.find(args.user as string);
        const role = args.role as CompanyRole;
        const email = found.user.email;
        const body = await this.operations.send<unknown>({
            title: `Set ${email} to ${role}`,
            spec: setCompanyRole(
                this.config.credentials().companyId,
                found.user.id,
                role,
            ),
            flags: options,
        });
        if (body === undefined) return;
        const operationId = operationIdOf(body);
        if (operationId !== null && options.wait === false) {
            this.output.success(`Started setting ${email} to ${role}`, {
                operation_id: operationId,
                status: 'pending',
            });
            this.output.info(
                `Follow with: kinstactl operations wait ${operationId}`,
            );
            return;
        }
        this.output.success(`${email} is now ${role}`, {
            user_id: found.user.id,
            role,
            ...(operationId !== null && {operation_id: operationId}),
            status: 'completed',
        });
    }
}
