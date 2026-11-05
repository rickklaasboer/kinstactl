import {injectable} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';
import {DomainService} from './DomainService';

type Options = {env?: string};

@injectable()
export class DomainsListCommand implements BaseCommand<Options> {
    readonly name = 'domains list';
    readonly description = 'List the domains of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl domains list my-site',
        'kinstactl domains list my-site --env staging --json',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/domains',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly domains: DomainService,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        this.output.table(await this.domains.list(target.env.id), [
            {header: 'NAME', value: (d) => d.name},
            {header: 'ID', value: (d) => d.id},
            {
                header: 'CLOUDFLARE DNS',
                value: (d) => (d.uses_cloudflare_dns ? 'yes' : ''),
            },
        ]);
    }
}
