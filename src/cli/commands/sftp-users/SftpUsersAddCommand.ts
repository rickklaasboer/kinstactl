import {InvalidArgumentError} from 'commander';
import {injectable} from 'tsyringe';
import {addSftpAccount, type SftpPermission} from '@/client/endpoints/sftp';
import type {EndpointKey} from '@/client/request';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {redactKeys, SecretInput} from '../../services/SecretInput';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

type Options = {
    env?: string;
    password?: string;
    rootDirectory?: string;
    permission?: SftpPermission;
} & ActionFlags;

function parsePermission(v: string): SftpPermission {
    if (v !== 'read' && v !== 'write')
        throw new InvalidArgumentError('must be read or write');
    return v;
}

@injectable()
export class SftpUsersAddCommand implements BaseCommand<Options> {
    readonly name = 'sftp-users add';
    readonly description = 'Add an additional SFTP account to an environment';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'username',
            required: true,
            description: 'username of the new SFTP account',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--password <password>',
            description: '"-" reads it from stdin; omitted on a TTY prompts',
        },
        {
            flags: '--root-directory <path>',
            description: 'directory the account is restricted to',
        },
        {
            flags: '--permission <read|write>',
            description: 'access level of the account',
            parse: parsePermission,
        },
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl sftp-users add my-site deploy --password - --permission write < password.txt',
        'kinstactl sftp-users add my-site reader --root-directory /wp-content/uploads --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/additional-sftp-accounts',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly secrets: SecretInput,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const username = args.username as string;
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const password = await this.secrets.read(options.password, {
            flag: '--password',
            label: 'SFTP password',
        });
        await this.operations.run({
            title: `Add SFTP account ${username}`,
            spec: addSftpAccount(target.env.id, {
                username,
                password,
                rootDirectory: options.rootDirectory,
                permission: options.permission,
            }),
            target,
            flags: options,
            redact: redactKeys('password'),
        });
    }
}
