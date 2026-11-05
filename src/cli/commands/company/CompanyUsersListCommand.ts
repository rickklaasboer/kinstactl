import {injectable} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';
import {CompanyUserService} from './CompanyUserService';

@injectable()
export class CompanyUsersListCommand implements BaseCommand<object> {
    readonly name = 'company users list';
    readonly description = 'List the users of the company with their roles';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples = [
        'kinstactl company users list',
        'kinstactl company users list --json',
    ];
    readonly endpoints: EndpointKey[] = ['GET /company/{id}/users'];

    constructor(
        private readonly users: CompanyUserService,
        private readonly output: Output,
    ) {}

    async execute(_args: CommandArgs, _options: object): Promise<void> {
        this.output.table(await this.users.list(), [
            {header: 'EMAIL', value: (u) => u.user.email},
            {header: 'NAME', value: (u) => u.user.full_name ?? ''},
            {
                header: 'ROLES',
                value: (u) => u.capabilities.map((c) => c.role).join(', '),
            },
            {header: 'ID', value: (u) => u.user.id},
        ]);
    }
}
