import {injectable} from 'tsyringe';
import type {EndpointKey, RequestSpec} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

type Options = {env?: string} & ActionFlags;

export interface BotProtectionSetting {
    /** Last word of the command name, e.g. 'level'. */
    name: string;
    description: string;
    get: (envId: string) => RequestSpec;
    set: (envId: string, value: string) => RequestSpec;
    /** The GET and the PUT of the setting. */
    endpoints: [EndpointKey, EndpointKey];
    choices: readonly string[];
    /** The value to show, or null when the API reports no bot protection. */
    read: (body: unknown) => string | null;
    /** Maps the command's choice to the API value. */
    toApi: (choice: string) => string;
}

/** Shows or changes one bot protection setting; the subclass supplies the setting. */
// The cast: injectable()'s type rejects abstract classes. The decorator is
// still needed so TypeScript emits design:paramtypes, which subclasses inherit.
@(injectable() as ClassDecorator)
export abstract class BotProtectionSettingCommand
    implements BaseCommand<Options>
{
    protected abstract readonly setting: BotProtectionSetting;

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    // Getters: a field initializer here would run before the subclass sets `setting`.
    get name(): string {
        return `security bot-protection ${this.setting.name}`;
    }

    get description(): string {
        return this.setting.description;
    }

    get arguments(): ArgumentDef[] {
        return [
            {
                name: 'site',
                required: true,
                description: 'site name, display name or ID',
            },
            {
                name: 'value',
                required: false,
                description: 'new value; omit to show the current one',
                choices: this.setting.choices,
            },
        ];
    }

    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({dryRun: true, wait: true}),
    ];

    get examples(): string[] {
        const base = `kinstactl security bot-protection ${this.setting.name} klant-x`;
        return [
            `${base} --env live`,
            `${base} ${this.setting.choices[0]} --env live`,
        ];
    }

    get endpoints(): EndpointKey[] {
        return ['GET /sites', ...this.setting.endpoints];
    }

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const {setting} = this;
        const value = args.value;
        if (value === undefined) {
            const target = await this.resolver.resolveTarget(
                args.site,
                options.env,
                {write: false},
            );
            const body = await this.clients
                .client()
                .send<unknown>(setting.get(target.env.id));
            this.output.data(
                body,
                () => setting.read(body) ?? '(not configured)',
            );
            return;
        }
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        await this.operations.run({
            title: `Set bot protection ${setting.name} to ${value}`,
            spec: setting.set(target.env.id, setting.toApi(value)),
            target,
            flags: options,
        });
    }
}
