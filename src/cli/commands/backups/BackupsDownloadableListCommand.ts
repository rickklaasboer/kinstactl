import {injectable} from 'tsyringe';
import {listDownloadableBackups} from '@/client/endpoints/backups';
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
import {formatTime} from './BackupService';

type Options = {env?: string};

@injectable()
export class BackupsDownloadableListCommand implements BaseCommand<Options> {
    readonly name = 'backups downloadable list';
    readonly description =
        'List the downloadable backup archives of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl backups downloadable list klant-x --env live',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/downloadable-backups',
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
            .send<
                components['schemas']['GetDownloadableBackupsResponseSchema']
            >(listDownloadableBackups(target.env.id));
        const rows = res.environment.downloadable_backups;
        this.output.table(
            rows,
            [
                {header: 'ID', value: (b) => b.id},
                {header: 'CREATED', value: (b) => formatTime(b.created_at)},
                {header: 'EXPIRES', value: (b) => formatTime(b.expires_at)},
                {
                    header: 'LINK',
                    value: (b) =>
                        b.is_generation_in_progress
                            ? (b.download_link ?? 'generating')
                            : (b.download_link ?? ''),
                },
            ],
            rows,
        );
    }
}
