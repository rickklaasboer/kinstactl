import {injectable} from 'tsyringe';
import {
    listCompanyPlugins,
    listCompanyThemes,
} from '@/client/endpoints/account';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

type Options = {updates?: boolean; vulnerable?: boolean};

// The fields plugins and themes share; their environments[] differ and are not used.
type Item = Omit<
    components['schemas']['CompanyWordPressPlugins-Response']['company']['plugins']['items'][number],
    'environments'
>;
type Inventory = {total: number; last_updated_at: string; items: Item[]};

/** The company-wide plugin or theme inventory; the subclass picks the kind. */
// The cast: injectable()'s type rejects abstract classes. The decorator is
// still needed so TypeScript emits design:paramtypes, which subclasses inherit.
@(injectable() as ClassDecorator)
export abstract class CompanyWpItemsCommand implements BaseCommand<Options> {
    protected abstract readonly kind: 'plugins' | 'themes';

    constructor(
        private readonly clients: ClientProvider,
        private readonly config: ConfigService,
        private readonly output: Output,
    ) {}

    // Getters: a field initializer here would run before the subclass sets `kind`.
    get name(): string {
        return `company ${this.kind}`;
    }

    get description(): string {
        return `List the ${this.kind} in use across the company (filters apply client-side)`;
    }

    readonly arguments: ArgumentDef[] = [];

    get options(): OptionDef[] {
        return [
            {
                flags: '--updates',
                description: `only ${this.kind} with an update available`,
            },
            {
                flags: '--vulnerable',
                description: `only ${this.kind} whose latest version is vulnerable`,
            },
        ];
    }

    get examples(): string[] {
        return [
            `kinstactl company ${this.kind}`,
            `kinstactl company ${this.kind} --updates --vulnerable`,
        ];
    }

    get endpoints(): EndpointKey[] {
        return [
            this.kind === 'plugins'
                ? 'GET /company/{id}/wp-plugins'
                : 'GET /company/{id}/wp-themes',
        ];
    }

    private async fetch(): Promise<Inventory> {
        const companyId = this.config.credentials().companyId;
        const client = this.clients.client();
        if (this.kind === 'plugins') {
            const res = await client.send<
                components['schemas']['CompanyWordPressPlugins-Response']
            >(listCompanyPlugins(companyId));
            return res.company.plugins;
        }
        const res = await client.send<
            components['schemas']['CompanyWordPressThemes-Response']
        >(listCompanyThemes(companyId));
        return res.company.themes;
    }

    async execute(_args: CommandArgs, options: Options): Promise<void> {
        const inventory = await this.fetch();
        if (inventory.items.length === 0) {
            this.output.data(
                [],
                () =>
                    `No ${this.kind} in the inventory (last updated ${inventory.last_updated_at})`,
            );
            return;
        }
        const items = inventory.items.filter(
            (i) =>
                (!options.updates || i.update_count > 0) &&
                (!options.vulnerable || i.is_latest_version_vulnerable),
        );
        this.output.table(
            items,
            [
                {header: 'NAME', value: (i: Item) => i.name},
                {header: 'TITLE', value: (i: Item) => i.title},
                {header: 'LATEST', value: (i: Item) => i.latest_version ?? ''},
                {
                    header: 'ENVIRONMENTS',
                    value: (i: Item) => String(i.environment_count),
                },
                {
                    header: 'UPDATES',
                    value: (i: Item) => String(i.update_count),
                    color: (i: Item) =>
                        i.update_count > 0 ? 'yellow' : undefined,
                },
                {
                    header: 'VULNERABLE',
                    value: (i: Item) =>
                        i.is_latest_version_vulnerable ? 'yes' : '',
                    color: () => 'red',
                },
            ],
            items,
        );
    }
}
