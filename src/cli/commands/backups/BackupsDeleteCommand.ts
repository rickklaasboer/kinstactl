import {injectable} from 'tsyringe';
import {deleteBackup} from '@/client/endpoints/backups';
import type {EndpointKey} from '@/client/request';
import {
    actionOptions,
    type ActionFlags,
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
import {BackupService, formatTime, parseBackupId} from './BackupService';

type Options = {env?: string} & ActionFlags;

@injectable()
export class BackupsDeleteCommand implements BaseCommand<Options> {
    readonly name = 'backups delete';
    readonly description = 'Delete a backup';
    readonly arguments: ArgumentDef[] = [
        {name: 'site', required: true, description: 'site name or ID'},
        {
            name: 'backup-id',
            required: true,
            description: 'backup ID, see: backups list',
        },
    ];
    readonly options: OptionDef[] = [
        {
            flags: '--env <name>',
            description: 'environment (default: the only one)',
        },
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl backups delete my-site 123456789',
        'kinstactl backups delete my-site 123456789 --env staging --yes',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites/environments/{env_id}/backups',
        'DELETE /sites/environments/backups/{backup_id}',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly backups: BackupService,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const id = parseBackupId(args.backupId as string);
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const backup = await this.backups.findBackup(target, id);
        await this.operations.run({
            title: `Delete backup ${id} from ${target.site.name} (${target.env.name})`,
            spec: deleteBackup(id),
            target,
            flags: options,
            confirm: {
                action: `Delete backup ${id} (${formatTime(backup.created_at)})`,
                level: 'confirm',
            },
        });
    }
}
