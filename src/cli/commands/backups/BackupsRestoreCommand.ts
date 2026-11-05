import {injectable} from 'tsyringe';
import {restoreBackup} from '@/client/endpoints/backups';
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

@injectable()
export class BackupsRestoreCommand implements BaseCommand {
    readonly name = 'backups restore';
    readonly description = 'Restore a backup, replacing the environment';
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
            description: 'environment to restore to (default: the only one)',
        },
        {
            flags: '--notify <email>',
            description: 'company user to notify when the restore finishes',
        },
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl backups restore klant-x 123456789 --notify rick@example.com',
        'kinstactl backups restore klant-x 123456789 --env staging --notify rick@example.com --yes',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites/environments/{env_id}/backups',
        'GET /company/{id}/users',
        'POST /sites/environments/{target_env_id}/backups/restore',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly backups: BackupService,
        private readonly operations: OperationRunner,
    ) {}

    async execute(
        args: CommandArgs,
        options: Record<string, unknown>,
    ): Promise<void> {
        const id = parseBackupId(args.backupId as string);
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env as string | undefined,
            {write: true},
        );
        const backup = await this.backups.findBackup(target, id);
        const userId = await this.backups.resolveNotifiedUser(
            options.notify as string | undefined,
        );
        await this.operations.run({
            title: `Restore backup ${id} to ${target.site.name} (${target.env.name})`,
            spec: restoreBackup(target.env.id, id, userId),
            target,
            flags: options as unknown as ActionFlags,
            confirm: {
                action: `Restore backup ${id} (${formatTime(backup.created_at)})`,
                level: 'confirm',
            },
        });
    }
}
