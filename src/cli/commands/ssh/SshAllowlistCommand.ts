import {injectable} from 'tsyringe';
import {getSshAllowedIps, setSshAllowedIps} from '@/client/endpoints/ssh';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type Options = {
    env?: string;
    add?: string[];
    remove?: string[];
} & ActionFlags;

@injectable()
export class SshAllowlistCommand implements BaseCommand<Options> {
    readonly name = 'ssh allowlist';
    readonly description =
        'Show or change the IP allowlist for SSH and SFTP access';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {flags: '--add <ip...>', description: 'IP addresses to add'},
        {flags: '--remove <ip...>', description: 'IP addresses to remove'},
        ...actionOptions({wait: false}),
    ];
    readonly examples = [
        'kinstactl ssh allowlist klant-x --env live',
        'kinstactl ssh allowlist klant-x --add 203.0.113.7',
        'kinstactl ssh allowlist klant-x --remove 203.0.113.7 --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/ssh/get-allowed-ips',
        'POST /sites/environments/{env_id}/ssh/set-allowed-ips',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const changing =
            options.add !== undefined || options.remove !== undefined;
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: changing},
        );
        const res = await this.clients
            .client()
            .send<components['schemas']['GetSftpSshAllowlist-Response']>(
                getSshAllowedIps(target.env.id),
            );
        const current = res.environment.active_container.sftp_ip_allowlist;

        if (!changing) {
            this.output.data(current, () => current.join('\n'));
            return;
        }

        const add = options.add ?? [];
        const remove = options.remove ?? [];
        const present = add.filter((ip) => current.includes(ip));
        if (present.length > 0)
            throw new CliError(
                'USAGE',
                `Already in the allowlist: ${present.join(', ')}`,
            );
        const unknown = remove.filter((ip) => !current.includes(ip));
        if (unknown.length > 0)
            throw new CliError(
                'USAGE',
                `Not in the allowlist: ${unknown.join(', ')}`,
            );
        const next = [...current.filter((ip) => !remove.includes(ip)), ...add];

        const sent = await this.operations.send({
            title: 'Update SSH allowlist',
            spec: setSshAllowedIps(target.env.id, next),
            target,
            flags: options,
        });
        if (sent === undefined) return;
        this.output.success('Allowlist updated', {ip_allowlist: next});
    }
}
