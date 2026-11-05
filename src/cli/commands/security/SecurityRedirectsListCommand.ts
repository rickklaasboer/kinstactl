import {InvalidArgumentError} from 'commander';
import {injectable} from 'tsyringe';
import {
    listRedirectRules,
    type RedirectRulesQuery,
} from '@/client/endpoints/security';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';
import type {RedirectRulesResponse} from './RedirectRuleService';

type SortKey = NonNullable<RedirectRulesQuery['key']>;
const SORT_KEYS: SortKey[] = ['domain', 'from', 'to', 'type'];

type Options = {
    env?: string;
    limit: number;
    offset?: number;
    search?: string;
    regex?: boolean;
    sort?: SortKey;
    desc?: boolean;
};

function parseCount(min: number) {
    return (v: string): number => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < min)
            throw new InvalidArgumentError(
                min === 0
                    ? 'must be a non-negative integer'
                    : 'must be a positive integer',
            );
        return n;
    };
}

function parseSortKey(v: string): SortKey {
    const key = SORT_KEYS.find((k) => k === v);
    if (key === undefined)
        throw new InvalidArgumentError(
            `must be one of ${SORT_KEYS.join(', ')}`,
        );
    return key;
}

@injectable()
export class SecurityRedirectsListCommand implements BaseCommand<Options> {
    readonly name = 'security redirects list';
    readonly description = 'List the redirect rules of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--limit <n>',
            description: 'number of rules to show',
            parse: parseCount(1),
            default: 10,
        },
        {
            flags: '--offset <n>',
            description: 'number of rules to skip',
            parse: parseCount(0),
        },
        {
            flags: '--search <text>',
            description: 'only rules matching this text',
        },
        {flags: '--regex', description: 'treat --search as a regex'},
        {
            flags: '--sort <key>',
            description: `sort by ${SORT_KEYS.join(', ')}`,
            parse: parseSortKey,
        },
        {flags: '--desc', description: 'sort descending'},
    ];
    readonly examples = [
        'kinstactl security redirects list my-site --env live',
        'kinstactl security redirects list my-site --search /blog --sort from --desc',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/redirect-rules',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const res = await this.clients.client().send<RedirectRulesResponse>(
            listRedirectRules(target.env.id, {
                limit: options.limit,
                offset: options.offset,
                key: options.sort,
                order:
                    options.desc === undefined
                        ? undefined
                        : options.desc
                          ? 'descend'
                          : 'ascend',
                searchQuery: options.search,
                regexSearch: options.regex,
            }),
        );
        const {rules, redirect_rules_count: count} =
            res.environment.container_info.redirect_rules;
        this.output.table(
            rules,
            [
                {header: 'FROM', value: (r) => r.from},
                {header: 'TO', value: (r) => r.to},
                {header: 'TYPE', value: (r) => r.type},
                {header: 'DOMAIN', value: (r) => r.domain ?? '(all)'},
            ],
            res,
        );
        this.output.info(`${rules.length} of ${count} rules`);
    }
}
