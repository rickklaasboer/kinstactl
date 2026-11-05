import {injectable} from 'tsyringe';
import {deleteSftpAccount, listSftpAccounts} from '@/client/endpoints/sftp';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {ClientProvider} from '../../services/ClientProvider';
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
    Destructive,
    OptionDef,
} from '../BaseCommand';

type Options = {env?: string} & ActionFlags;

@injectable()
export class SftpUsersDeleteCommand implements BaseCommand<Options> {
    readonly name = 'sftp-users delete';
    readonly description = 'Delete an additional SFTP account';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'username',
            required: true,
            description: 'username of the SFTP account, see: sftp-users list',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl sftp-users delete klant-x deploy',
        'kinstactl sftp-users delete klant-x deploy --env live --yes',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/additional-sftp-accounts',
        'DELETE /sites/environments/additional-sftp-accounts/{sftp_account_id}',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const username = args.username as string;
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const res = await this.clients
            .client()
            .send<components['schemas']['GetAdditionalSftpAccountsResponse']>(
                listSftpAccounts(target.env.id),
            );
        const accounts = res.environment.additional_sftp_accounts;
        const account = accounts.find(
            (a) => a.username.toLowerCase() === username.toLowerCase(),
        );
        if (!account)
            throw new CliError(
                'USAGE',
                `no SFTP account "${username}" on ${target.site.name} (${target.env.name})`,
                accounts.map((a) => a.username),
            );
        await this.operations.run({
            title: `Delete SFTP account ${account.username} from ${target.site.name} (${target.env.name})`,
            spec: deleteSftpAccount(account.id),
            target,
            flags: options,
            confirm: {
                action: `Delete SFTP account ${account.username}`,
                level: 'confirm',
            },
        });
    }
}
