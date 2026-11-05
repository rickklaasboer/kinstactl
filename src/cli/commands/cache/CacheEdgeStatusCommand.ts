import {injectable} from 'tsyringe';
import {setEdgeCacheStatus} from '@/client/endpoints/tools';
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

/** Switches edge caching on or off; the subclass picks the direction. */
// The cast: injectable()'s type rejects abstract classes. The decorator is
// still needed so TypeScript emits design:paramtypes, which subclasses inherit.
@(injectable() as ClassDecorator)
export abstract class CacheEdgeStatusCommand implements BaseCommand<Options> {
    protected abstract readonly enabled: boolean;

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    // Getters: a field initializer here would run before the subclass sets `enabled`.
    get name(): string {
        return `cache edge ${this.enabled ? 'enable' : 'disable'}`;
    }

    get description(): string {
        return `${this.enabled ? 'Enable' : 'Disable'} edge caching of an environment`;
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
            `kinstactl cache edge ${verb} my-site --env live`,
            `kinstactl cache edge ${verb} my-site --env live --dry-run`,
        ];
    }

    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'PUT /sites/edge-caching/status',
    ];

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        await this.operations.run({
            title: `${this.enabled ? 'Enable' : 'Disable'} edge cache`,
            spec: setEdgeCacheStatus(target.env.id, this.enabled),
            target,
            flags: options,
        });
    }
}
