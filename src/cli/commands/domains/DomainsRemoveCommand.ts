import {injectable} from 'tsyringe';
import {deleteSiteDomains} from '@/client/endpoints/domains';
import type {EndpointKey} from '@/client/request';
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
import {DomainService} from './DomainService';

type Options = {env?: string} & ActionFlags;

@injectable()
export class DomainsRemoveCommand implements BaseCommand<Options> {
    readonly name = 'domains remove';
    readonly description = 'Remove a domain from an environment';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'domain',
            required: true,
            description: 'domain name or ID, see: domains list',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl domains remove klant-x example.com',
        'kinstactl domains remove klant-x example.com --env live --yes',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/domains',
        'DELETE /sites/environments/{env_id}/domains',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly domains: DomainService,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const domain = await this.domains.find(target, args.domain as string);
        await this.operations.run({
            title: `Remove domain ${domain.name} from ${target.site.name} (${target.env.name})`,
            spec: deleteSiteDomains(target.env.id, [domain.id]),
            target,
            flags: options,
            confirm: {
                action: `Remove domain ${domain.name}`,
                level: 'confirm',
            },
        });
    }
}
