import {injectable} from 'tsyringe';
import {toggleSftpAccounts} from '@/client/endpoints/sftp';
import type {EndpointKey} from '@/client/request';
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

/** Switches the additional SFTP accounts of an environment on or off; the subclass picks the direction. */
// The cast: injectable()'s type rejects abstract classes. The decorator is
// still needed so TypeScript emits design:paramtypes, which subclasses inherit.
@(injectable() as ClassDecorator)
export abstract class SftpUsersStatusCommand implements BaseCommand<Options> {
    protected abstract readonly enabled: boolean;

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    // Getters: a field initializer here would run before the subclass sets `enabled`.
    get name(): string {
        return `sftp-users ${this.enabled ? 'enable' : 'disable'}`;
    }

    get description(): string {
        return `${this.enabled ? 'Enable' : 'Disable'} the additional SFTP accounts of an environment`;
    }

    readonly arguments: ArgumentDef[] = [siteArgument()];

    get options(): OptionDef[] {
        return [
            {
                flags: '--env <environment>',
                description: 'environment name or ID',
            },
            ...actionOptions({}),
        ];
    }

    get examples(): string[] {
        const verb = this.enabled ? 'enable' : 'disable';
        return [
            `kinstactl sftp-users ${verb} my-site --env live`,
            `kinstactl sftp-users ${verb} my-site --env live --dry-run`,
        ];
    }

    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'PUT /sites/environments/{env_id}/additional-sftp-accounts/toggle-status',
    ];

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        await this.operations.run({
            title: `${this.enabled ? 'Enable' : 'Disable'} additional SFTP accounts`,
            spec: toggleSftpAccounts(target.env.id, this.enabled),
            target,
            flags: options,
        });
    }
}
