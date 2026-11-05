import {injectable} from 'tsyringe';
import {createManualBackup} from '@/client/endpoints/backups';
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
    OptionDef,
} from '../BaseCommand';

@injectable()
export class BackupsCreateCommand implements BaseCommand {
    readonly name = 'backups create';
    readonly description = 'Create a manual backup';
    readonly arguments: ArgumentDef[] = [
        {name: 'site', required: true, description: 'site name or ID'},
    ];
    readonly options: OptionDef[] = [
        {
            flags: '--env <name>',
            description: 'environment (default: the only one)',
        },
        {flags: '--tag <text>', description: 'label for the backup'},
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl backups create klant-x',
        'kinstactl backups create klant-x --env live --tag "before plugin update"',
    ];
    readonly endpoints: EndpointKey[] = [
        'POST /sites/environments/{env_id}/manual-backups',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(
        args: CommandArgs,
        options: Record<string, unknown>,
    ): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env as string | undefined,
            {write: true},
        );
        await this.operations.run({
            title: `Create backup of ${target.site.name} (${target.env.name})`,
            spec: createManualBackup(
                target.env.id,
                options.tag as string | undefined,
            ),
            target,
            flags: options as unknown as ActionFlags,
        });
    }
}
