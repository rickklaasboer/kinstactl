import {injectable} from 'tsyringe';
import {
    createDownloadableBackup,
    listDownloadableBackups,
} from '@/client/endpoints/backups';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
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

type Options = {env?: string} & ActionFlags;

@injectable()
export class BackupsDownloadableCreateCommand implements BaseCommand<Options> {
    readonly name = 'backups downloadable create';
    readonly description = 'Create a downloadable backup archive';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl backups downloadable create klant-x --env live',
        'kinstactl backups downloadable create klant-x --env live --no-wait',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/downloadable-backups',
        'GET /sites/environments/{env_id}/downloadable-backups',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const result = await this.operations.run({
            title: 'Create downloadable backup',
            spec: createDownloadableBackup(target.env.id),
            target,
            flags: options,
        });
        // No result: dry run or --no-wait, so there is no finished archive to show.
        if (result === undefined) return;

        const res = await this.clients
            .client()
            .send<
                components['schemas']['GetDownloadableBackupsResponseSchema']
            >(listDownloadableBackups(target.env.id));
        const newest = res.environment.downloadable_backups.reduce<
            components['schemas']['DownloadableBackup'] | undefined
        >(
            (a, b) => (a === undefined || b.created_at > a.created_at ? b : a),
            undefined,
        );
        if (newest === undefined)
            throw new Error(
                'Downloadable backup finished but the environment lists none',
            );
        const link = newest.download_link ?? '(still generating)';
        this.output.data(
            {
                download_link: newest.download_link,
                expires_at: newest.expires_at,
            },
            () => link,
        );
    }
}
