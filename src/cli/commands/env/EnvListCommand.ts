import {injectable} from 'tsyringe';
import {listEnvironments} from '@/client/endpoints/environments';
import type {components} from '@/client/generated/openapi';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

type EnvironmentsResponse = components['schemas']['GetEnvironments-Response'];

@injectable()
export class EnvListCommand implements BaseCommand {
    readonly name = 'env list';
    readonly description = 'List the environments of a site';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
    ];
    readonly options: OptionDef[] = [];
    readonly examples = [
        'kinstactl env list klant-x',
        'kinstactl env list klant-x --json',
    ];
    readonly endpoints = [
        'GET /sites' as const,
        'GET /sites/{site_id}/environments' as const,
    ];

    constructor(
        private readonly output: Output,
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
    ) {}

    async execute(args: CommandArgs): Promise<void> {
        const site = await this.resolver.resolveSite(args.site, {
            fresh: false,
        });
        const res = await this.clients
            .client()
            .send<EnvironmentsResponse>(listEnvironments(site.id));
        const rows = res.site.environments;
        this.output.table(
            rows,
            [
                {header: 'NAME', value: (e) => e.name},
                {header: 'DISPLAY NAME', value: (e) => e.display_name},
                {
                    header: 'PHP',
                    value: (e) => e.container_info.php_engine_version,
                },
                {header: 'PRIMARY DOMAIN', value: (e) => e.primaryDomain.name},
                {header: 'ID', value: (e) => e.id},
            ],
            rows,
        );
    }
}
