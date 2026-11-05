import {injectable} from 'tsyringe';
import {changePrimaryDomain} from '@/client/endpoints/domains';
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

type Options = {env?: string; searchReplace?: boolean} & ActionFlags;

@injectable()
export class DomainsPrimaryCommand implements BaseCommand<Options> {
    readonly name = 'domains primary';
    readonly description = 'Change the primary domain of an environment';
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
        {
            flags: '--search-replace',
            description: 'also rewrite the old URL in the database',
        },
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl domains primary klant-x example.com',
        'kinstactl domains primary klant-x example.com --search-replace --yes',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/domains',
        'PUT /sites/environments/{env_id}/change-primary-domain',
    ];
    // Only with --search-replace; without it the change needs no confirmation.
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
        const searchReplace = options.searchReplace === true;
        await this.operations.run({
            title: `Change primary domain of ${target.site.name} (${target.env.name}) to ${domain.name}`,
            spec: changePrimaryDomain(target.env.id, domain.id, searchReplace),
            target,
            flags: options,
            confirm: searchReplace
                ? {
                      action: `Change primary domain to ${domain.name} with search and replace`,
                      level: 'confirm',
                  }
                : undefined,
        });
    }
}
