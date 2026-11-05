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

type Options = {
    env?: string;
    fromEnv?: string;
    notify?: string;
} & ActionFlags;

@injectable()
export class BackupsRestoreCommand implements BaseCommand<Options> {
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
            flags: '--from-env <environment>',
            description: 'environment the backup was taken on (default: --env)',
        },
        {
            flags: '--notify <email>',
            description: 'company user to notify when the restore finishes',
        },
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl backups restore my-site 123456789 --notify rick@example.com',
        'kinstactl backups restore my-site 123456789 --env staging --notify rick@example.com --yes',
        'kinstactl backups restore my-site 123456789 --from-env staging --env live --notify rick@example.com',
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

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const id = parseBackupId(args.backupId as string);
        const site = await this.resolver.resolveSite(args.site, {fresh: true});
        const to = await this.resolver.resolveEnv(site, options.env);
        const from =
            options.fromEnv === undefined
                ? to
                : await this.resolver.resolveEnv(site, options.fromEnv, {
                      flag: '--from-env',
                      message: 'Restore a backup of which environment?',
                  });
        const backup = await this.backups.findBackup({site, env: from}, id);
        const userId = await this.backups.resolveNotifiedUser(options.notify);
        await this.operations.run({
            title: `Restore backup ${id} from ${from.name} to ${site.name} (${to.name})`,
            spec: restoreBackup(to.id, id, userId),
            target: {site, env: to},
            flags: options,
            confirm: {
                action: `Restore backup ${id} (${formatTime(backup.created_at)}) from ${from.name}`,
                level: 'confirm',
            },
        });
    }
}
