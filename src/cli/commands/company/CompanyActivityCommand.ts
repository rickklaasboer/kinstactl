import {InvalidArgumentError} from 'commander';
import {injectable} from 'tsyringe';
import {
    type ActivityCategory,
    type ActivityLanguage,
    listActivityLogs,
} from '@/client/endpoints/account';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';
import {formatTime} from '../backups/BackupService';

const CATEGORIES: readonly ActivityCategory[] = [
    'siteActions',
    'kinstaDns',
    'migrations',
    'billing',
    'notifications',
    'userManagement',
    'personalSettings',
    'samlSso',
];

const LANGUAGES: readonly ActivityLanguage[] = [
    'da',
    'de',
    'en',
    'es',
    'fr',
    'it',
    'ja',
    'nl',
    'pt',
    'sv',
];

function oneOf<T extends string>(values: readonly T[]) {
    return (v: string): T => {
        if (!(values as readonly string[]).includes(v))
            throw new InvalidArgumentError(
                `must be one of: ${values.join(', ')}`,
            );
        return v as T;
    };
}

function parseCount(min: number) {
    return (v: string): number => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < min)
            throw new InvalidArgumentError(
                `must be an integer of at least ${min}`,
            );
        return n;
    };
}

type Options = {
    limit: number;
    offset?: number;
    category?: ActivityCategory;
    site?: string;
    language?: ActivityLanguage;
};

type Item =
    components['schemas']['getUserActivityLogs-Response']['company']['activity_logs']['items'][number];

function status(i: Item): string {
    if (i.has_failed) return 'failed';
    if (i.has_warning) return 'warning';
    if (i.is_done) return 'done';
    return 'pending';
}

@injectable()
export class CompanyActivityCommand implements BaseCommand<Options> {
    readonly name = 'company activity';
    readonly description = 'Show the activity log of the company';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [
        {
            flags: '--limit <n>',
            description: 'number of entries',
            parse: parseCount(1),
            default: 10,
        },
        {
            flags: '--offset <n>',
            description: 'entries to skip',
            parse: parseCount(0),
        },
        {
            flags: '--category <category>',
            description: `one of: ${CATEGORIES.join(', ')}`,
            parse: oneOf(CATEGORIES),
        },
        {
            flags: '--site <site>',
            description: 'only entries of this site (name, display name or ID)',
        },
        {
            flags: '--language <code>',
            description: `language of the descriptions: ${LANGUAGES.join(', ')}`,
            parse: oneOf(LANGUAGES),
        },
    ];
    readonly examples = [
        'kinstactl company activity',
        'kinstactl company activity --category siteActions --site my-site --limit 25',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /company/{id}/activity-logs',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
        private readonly config: ConfigService,
        private readonly output: Output,
    ) {}

    async execute(_args: CommandArgs, options: Options): Promise<void> {
        const site =
            options.site === undefined
                ? undefined
                : await this.resolver.resolveSite(options.site, {fresh: false});
        const res = await this.clients
            .client()
            .send<components['schemas']['getUserActivityLogs-Response']>(
                listActivityLogs(this.config.credentials().companyId, {
                    limit: options.limit,
                    offset: options.offset,
                    category: options.category,
                    siteId: site?.id,
                    language: options.language,
                }),
            );
        const {items, total} = res.company.activity_logs;
        this.output.table(
            items,
            [
                {header: 'DATE', value: (i) => formatTime(i.created_at)},
                {header: 'TYPE', value: (i) => i.type},
                {header: 'SITE', value: (i) => i.site_id ?? ''},
                {
                    header: 'BY',
                    value: (i) =>
                        i.initiated_by?.full_name ?? i.api_key_info?.name ?? '',
                },
                {
                    header: 'STATUS',
                    value: status,
                    color: (i) =>
                        i.has_failed
                            ? 'red'
                            : i.has_warning
                              ? 'yellow'
                              : undefined,
                },
            ],
            res.company.activity_logs,
        );
        this.output.info(`${items.length} of ${total}`);
    }
}
