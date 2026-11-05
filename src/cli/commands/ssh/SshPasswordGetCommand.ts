import {injectable} from 'tsyringe';
import {getSshPassword} from '@/client/endpoints/ssh';
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

/** The one command that prints a secret: the password is the whole point. */
@injectable()
export class SshPasswordGetCommand implements BaseCommand<Options> {
    readonly name = 'ssh password get';
    readonly description = 'Print the SSH/SFTP password of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl ssh password get my-site --env live',
        'kinstactl ssh password get my-site --json',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/ssh/password',
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
            .send<components['schemas']['GetSftpPassword-Response']>(
                getSshPassword(target.env.id),
            );
        const password = res.environment.sftp_password;
        this.output.data({sftp_password: password}, () => password);
    }
}
