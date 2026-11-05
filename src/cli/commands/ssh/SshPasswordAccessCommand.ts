import {injectable} from 'tsyringe';
import {setSshPasswordStatus} from '@/client/endpoints/ssh';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
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

/** Switches SSH/SFTP password login on or off; the subclass picks the direction. */
// The cast: injectable()'s type rejects abstract classes. The decorator is
// still needed so TypeScript emits design:paramtypes, which subclasses inherit.
@(injectable() as ClassDecorator)
export abstract class SshPasswordAccessCommand implements BaseCommand<Options> {
    protected abstract readonly enabled: boolean;

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    // Getters: a field initializer here would run before the subclass sets `enabled`.
    get name(): string {
        return `ssh password ${this.enabled ? 'enable' : 'disable'}`;
    }

    get description(): string {
        return `${this.enabled ? 'Enable' : 'Disable'} SSH/SFTP password login of an environment`;
    }

    readonly arguments: ArgumentDef[] = [siteArgument()];

    get options(): OptionDef[] {
        return [
            {
                flags: '--env <environment>',
                description: 'environment name or ID',
            },
            ...actionOptions({wait: false}),
        ];
    }

    get examples(): string[] {
        const verb = this.enabled ? 'enable' : 'disable';
        return [
            `kinstactl ssh password ${verb} klant-x --env live`,
            `kinstactl ssh password ${verb} klant-x --env live --dry-run`,
        ];
    }

    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/ssh/set-password-status',
    ];

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const res = await this.operations.send({
            title: `${this.enabled ? 'Enable' : 'Disable'} SSH password login`,
            spec: setSshPasswordStatus(target.env.id, this.enabled),
            target,
            flags: options,
        });
        if (res === undefined) return;
        this.output.success(
            `SSH password login ${this.enabled ? 'enabled' : 'disabled'}`,
            {is_password_enabled: this.enabled},
        );
    }
}
