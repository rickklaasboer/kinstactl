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
import {BackupService, formatTime} from './BackupService';

type Options = {env?: string; type?: string};

@injectable()
export class BackupsListCommand implements BaseCommand<Options> {
    readonly name = 'backups list';
    readonly description = 'List the backups of an environment, newest first';
    readonly arguments: ArgumentDef[] = [siteArgument('site name or ID')];
    readonly options: OptionDef[] = [
        {
            flags: '--env <name>',
            description: 'environment (default: the only one)',
        },
        {
            flags: '--type <type>',
            description:
                'only this backup type, e.g. manual, scheduled or system',
        },
    ];
    readonly examples = [
        'kinstactl backups list my-site',
        'kinstactl backups list my-site --env staging --type manual',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites/environments/{env_id}/backups',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly backups: BackupService,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const rows = (await this.backups.fetchBackups(target.env.id))
            .filter(
                (b) => options.type === undefined || b.type === options.type,
            )
            .sort((a, b) => b.created_at - a.created_at);
        this.output.table(rows, [
            {header: 'ID', value: (b) => String(b.id)},
            {header: 'TYPE', value: (b) => b.type},
            {header: 'NOTE', value: (b) => b.note ?? ''},
            {header: 'CREATED', value: (b) => formatTime(b.created_at)},
        ]);
    }
}
