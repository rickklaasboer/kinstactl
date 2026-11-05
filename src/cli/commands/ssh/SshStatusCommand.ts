import {injectable} from 'tsyringe';
import {getSshStatus} from '@/client/endpoints/ssh';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
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

@injectable()
export class SshStatusCommand implements BaseCommand<Options> {
    readonly name = 'ssh status';
    readonly description = 'Show whether SSH and SFTP access is enabled';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl ssh status my-site --env live',
        'kinstactl ssh status my-site --json',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/ssh/get-status',
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
            .send<components['schemas']['GetSftpSshStatus-Response']>(
                getSshStatus(target.env.id),
            );
        const enabled = res.environment.active_container.is_ssh_enabled;
        this.output.data(
            {
                site: target.site.name,
                environment: target.env.name,
                is_ssh_enabled: enabled,
            },
            () => (enabled ? 'enabled' : 'disabled'),
        );
    }
}
