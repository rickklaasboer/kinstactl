import {injectable} from 'tsyringe';
import {listSftpAccounts} from '@/client/endpoints/sftp';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {ClientProvider} from '../../services/ClientProvider';
import {Output} from '../../output';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type Options = {env?: string};

@injectable()
export class SftpUsersListCommand implements BaseCommand<Options> {
    readonly name = 'sftp-users list';
    readonly description =
        'List the additional SFTP accounts of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl sftp-users list klant-x',
        'kinstactl sftp-users list klant-x --env staging --json',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/{site_id}/environments',
        'GET /sites/environments/{env_id}/additional-sftp-accounts',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const res = await this.clients
            .client()
            .send<components['schemas']['GetAdditionalSftpAccountsResponse']>(
                listSftpAccounts(target.env.id),
            );
        const details = await this.resolver.details(target);
        const {additional_sftp_accounts: accounts, container_info: info} =
            res.environment;
        this.output.table(accounts, [
            {header: 'USERNAME', value: (a) => a.username},
            {header: 'ROOT', value: (a) => a.root_directory},
            {header: 'PERMISSION', value: (a) => a.permission},
            {header: 'ACTIVE', value: (a) => (a.is_active ? 'yes' : 'no')},
            {header: 'ID', value: (a) => a.id},
        ]);
        this.output.info(
            `Additional SFTP accounts are ${details.is_additional_sftp_accounts_enabled ? 'enabled' : 'disabled'}; port ${info.additional_sftp_accounts_port ?? '(none)'}`,
        );
    }
}
