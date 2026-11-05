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
import {hasUpdate, type WpItemKind} from './WpItemKind';
import {WpItemService} from './WpItemService';

type Options = {env?: string; updates?: boolean};

/** Lists the plugins or themes of an environment; the subclass picks the kind. */
// The cast: injectable()'s type rejects abstract classes. The decorator is
// still needed so TypeScript emits design:paramtypes, which subclasses inherit.
@(injectable() as ClassDecorator)
export abstract class WpItemListCommand implements BaseCommand<Options> {
    protected abstract readonly kind: WpItemKind;

    constructor(
        private readonly resolver: SiteResolver,
        private readonly items: WpItemService,
        private readonly output: Output,
    ) {}

    // Getters: a field initializer here would run before the subclass sets `kind`.
    get name(): string {
        return `${this.kind.command} list`;
    }

    get description(): string {
        return `List the ${this.kind.command} of an environment`;
    }

    readonly arguments: ArgumentDef[] = [siteArgument('site name or ID')];

    get options(): OptionDef[] {
        return [
            {flags: '--env <env>', description: 'environment name or ID'},
            {
                flags: '--updates',
                description: `only ${this.kind.command} with an update available`,
            },
        ];
    }

    get examples(): string[] {
        const {command} = this.kind;
        return [
            `kinstactl ${command} list klant-x --env live`,
            `kinstactl ${command} list klant-x --env live --updates`,
        ];
    }

    get endpoints(): EndpointKey[] {
        return [this.kind.endpoints.list];
    }

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const {env} = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const all = await this.items.fetch(this.kind, env.id);
        const items = options.updates ? all.filter(hasUpdate) : all;
        this.output.table(
            items,
            [
                {header: 'NAME', value: (i) => i.name},
                {header: 'STATUS', value: (i) => i.status},
                {header: 'VERSION', value: (i) => i.version},
                {
                    header: 'UPDATE',
                    value: (i) =>
                        hasUpdate(i) ? (i.update_version ?? i.update) : '',
                    color: () => 'yellow',
                },
                {
                    header: 'VULNERABLE',
                    value: (i) => (i.is_version_vulnerable ? 'yes' : ''),
                    color: () => 'red',
                },
            ],
            items,
        );
    }
}
