import {injectable} from 'tsyringe';
import {listDeniedIps, setDeniedIps} from '@/client/endpoints/tools';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {editList} from '../../services/listEdit';
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
    type Destructive,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type Options = {
    env?: string;
    add?: string[];
    remove?: string[];
    clear?: boolean;
} & ActionFlags;

@injectable()
export class SecurityDeniedIpsCommand implements BaseCommand<Options> {
    readonly name = 'security denied-ips';
    readonly description = 'Show or change the denied IPs of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {flags: '--add <ip...>', description: 'IP addresses to deny'},
        {flags: '--remove <ip...>', description: 'IP addresses to allow again'},
        {flags: '--clear', description: 'remove every denied IP'},
        ...actionOptions({wait: false, destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl security denied-ips klant-x --env live',
        'kinstactl security denied-ips klant-x --add 203.0.113.7 --yes',
        'kinstactl security denied-ips klant-x --clear --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/tools/denied-ips',
        'PUT /sites/tools/denied-ips',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const changing =
            options.add !== undefined ||
            options.remove !== undefined ||
            options.clear === true;
        if (
            options.clear &&
            (options.add !== undefined || options.remove !== undefined)
        )
            throw new CliError(
                'USAGE',
                '--clear cannot be combined with --add or --remove',
            );

        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: changing},
        );
        const res = await this.clients
            .client()
            .send<components['schemas']['GetDeniedIPsResponse']>(
                listDeniedIps(target.env.id),
            );
        const current = res.environment.ip_list;

        if (!changing) {
            this.output.data(current, () => current.join('\n'));
            return;
        }

        const next = options.clear
            ? []
            : editList(
                  current,
                  options.add ?? [],
                  options.remove ?? [],
                  'the denied IPs',
              );

        const sent = await this.operations.send({
            title: 'Update denied IPs',
            spec: setDeniedIps(target.env.id, next),
            target,
            flags: options,
            confirm: {
                action: `Overwrite denied IPs (${next.length} entries)`,
                level: 'confirm',
            },
        });
        if (sent === undefined) return;
        this.output.success('Denied IPs updated', {ip_list: next});
    }
}
