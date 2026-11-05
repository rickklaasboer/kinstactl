import {injectable} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
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
import {hasUpdate, type WpItemKind} from './WpItemKind';
import {WpItemService} from './WpItemService';

/** Updates one plugin or theme, or all with an update; the subclass picks the kind. */
// The cast: injectable()'s type rejects abstract classes. The decorator is
// still needed so TypeScript emits design:paramtypes, which subclasses inherit.
@(injectable() as ClassDecorator)
export abstract class WpItemUpdateCommand implements BaseCommand {
    protected abstract readonly kind: WpItemKind;

    constructor(
        private readonly resolver: SiteResolver,
        private readonly items: WpItemService,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    // Getters: a field initializer here would run before the subclass sets `kind`.
    get name(): string {
        return `${this.kind.command} update`;
    }

    get description(): string {
        const {noun, command} = this.kind;
        return `Update one ${noun}, or all ${command} with an update`;
    }

    get arguments(): ArgumentDef[] {
        return [
            {name: 'site', required: true, description: 'site name or ID'},
            {
                name: 'name',
                required: false,
                description: `${this.kind.noun} name`,
            },
        ];
    }

    get options(): OptionDef[] {
        return [
            {flags: '--env <env>', description: 'environment name or ID'},
            {
                flags: '--all',
                description: `update every ${this.kind.noun} that has an update`,
            },
            ...actionOptions({}),
        ];
    }

    get examples(): string[] {
        const {command, noun} = this.kind;
        return [
            `kinstactl ${command} update klant-x ${noun === 'plugin' ? 'akismet' : 'twentytwentyfour'} --env live`,
            `kinstactl ${command} update klant-x --all --env live --dry-run`,
        ];
    }

    get endpoints(): EndpointKey[] {
        const {list, update, bulk} = this.kind.endpoints;
        return [list, update, bulk];
    }

    async execute(
        args: CommandArgs,
        options: Record<string, unknown>,
    ): Promise<void> {
        const {kind} = this;
        const {noun, command} = kind;
        const name = args.name;
        const all = options.all === true;
        const flags = options as unknown as ActionFlags;

        if (name === undefined && !all)
            throw new CliError('USAGE', `no ${noun} given`, [
                `pass a ${noun} name or --all`,
            ]);
        if (name !== undefined && all)
            throw new CliError(
                'USAGE',
                `pass either a ${noun} name or --all, not both`,
            );
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env as string | undefined,
            {write: true},
        );
        const items = await this.items.fetch(kind, target.env.id);

        if (name !== undefined) {
            const item = items.find((i) => i.name === name);
            if (!item)
                throw new CliError('USAGE', `${noun} not found: ${name}`);
            if (!hasUpdate(item))
                throw new CliError(
                    'USAGE',
                    `${noun} ${name} is already up to date`,
                );
            if (item.update_version === null)
                throw new CliError(
                    'API_ERROR',
                    `${noun} ${name} has an update but Kinsta gave no version`,
                );
            await this.operations.run({
                title: `Update ${noun} ${name}`,
                spec: kind.update(target.env.id, name, item.update_version),
                target,
                flags,
            });
            return;
        }

        const names = items.filter(hasUpdate).map((i) => i.name);
        if (names.length === 0) {
            this.output.success(`All ${command} are up to date`, {
                updated: [],
            });
            return;
        }
        await this.operations.run({
            title: `Update ${names.length} ${command}`,
            spec: kind.bulk(target.env.id, names),
            target,
            flags,
        });
    }
}
