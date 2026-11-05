import {InvalidArgumentError} from 'commander';
import {Lifecycle, scoped} from 'tsyringe';
import {
    listRedirectRules,
    type RedirectRule,
} from '@/client/endpoints/security';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../../errors';
import {ClientProvider} from '../../services/ClientProvider';

export type RedirectRulesResponse =
    components['schemas']['GetRedirectRulesResponse'];
export type ApiRedirectRule =
    RedirectRulesResponse['environment']['container_info']['redirect_rules']['rules'][number];

const PAGE_SIZE = 100;

export function parseRedirectType(v: string): RedirectRule['type'] {
    if (v !== 'permanent' && v !== 'redirect')
        throw new InvalidArgumentError('must be permanent or redirect');
    return v;
}

/** Reads the redirect rules of an environment and resolves a `from` to one stored rule. */
@scoped(Lifecycle.ContainerScoped)
export class RedirectRuleService {
    constructor(private readonly clients: ClientProvider) {}

    /** All rules: pages through listRedirectRules with limit 100 until redirect_rules_count is reached. */
    async all(envId: string): Promise<ApiRedirectRule[]> {
        const rules: ApiRedirectRule[] = [];
        for (;;) {
            const res = await this.clients.client().send<RedirectRulesResponse>(
                listRedirectRules(envId, {
                    limit: PAGE_SIZE,
                    offset: rules.length,
                }),
            );
            const {rules: page, redirect_rules_count: count} =
                res.environment.container_info.redirect_rules;
            rules.push(...page);
            if (rules.length >= count) return rules;
            if (page.length === 0)
                throw new Error(
                    `Redirect rules ended at ${rules.length} of ${count}`,
                );
        }
    }

    /** The rule with this `from` (and `domain` when given); none → USAGE listing the existing `from` values; several → USAGE asking for --domain. */
    async find(
        envId: string,
        from: string,
        domain?: string,
    ): Promise<ApiRedirectRule> {
        const rules = await this.all(envId);
        const found = rules.filter(
            (r) =>
                r.from === from &&
                (domain === undefined || r.domain === domain),
        );
        if (found.length === 1) return found[0]!;
        if (found.length > 1)
            throw new CliError(
                'USAGE',
                `Several redirect rules have from "${from}"; pick one with --domain`,
                found.map((r) => r.domain ?? '(all domains)'),
            );
        throw new CliError(
            'USAGE',
            domain === undefined
                ? `No redirect rule has from "${from}"`
                : `No redirect rule has from "${from}" on domain "${domain}"`,
            [...new Set(rules.map((r) => r.from))],
        );
    }
}
