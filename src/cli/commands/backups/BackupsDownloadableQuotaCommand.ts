import {injectable} from 'tsyringe';
import {nextDownloadableBackup} from '@/client/endpoints/backups';
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
export class BackupsDownloadableQuotaCommand implements BaseCommand<Options> {
    readonly name = 'backups downloadable quota';
    readonly description =
        'Check whether a new downloadable backup can be created';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl backups downloadable quota my-site --env live',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/next-downloadable-backup-available',
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
                components['schemas']['NextDownloadableBackupAvailableResponseSchema']
            >(nextDownloadableBackup(target.env.id));
        this.output.data(res, () =>
            res.is_backup_available
                ? 'available'
                : `next available at ${res.reset_at}`,
        );
    }
}
