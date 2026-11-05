import {injectable} from 'tsyringe';
import {getSshConfig} from '@/client/endpoints/ssh';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type Options = {env?: string};

type SftpConfig = components['schemas']['GetSftpConfig-Response'];

/** The one place that knows the response shape: the nested `site` object. */
function readConnection(res: SftpConfig) {
    const container = res.site?.environment?.activeContainer;
    if (!container)
        throw new CliError(
            'API_ERROR',
            'Response has no SSH connection details',
        );
    return {
        host: container.loadBalancer.extIP,
        port: container.lxdSshPort,
        user: res.site.usr,
    };
}

@injectable()
export class SshConfigCommand implements BaseCommand<Options> {
    readonly name = 'ssh config';
    readonly description = 'Show the SSH/SFTP connection details';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl ssh config klant-x --env live',
        'kinstactl ssh config klant-x --json',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/{site_id}/environments/{env_id}/ssh/config',
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
            .send<SftpConfig>(getSshConfig(target.site.id, target.env.id));
        const {host, port, user} = readConnection(res);
        const sshCommand = `ssh ${user}@${host} -p ${port}`;
        this.output.data({host, port, user, ssh_command: sshCommand}, () =>
            [
                `Host: ${host}`,
                `Port: ${port}`,
                `User: ${user}`,
                sshCommand,
            ].join('\n'),
        );
    }
}
