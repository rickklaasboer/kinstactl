import {inject, Lifecycle, scoped} from 'tsyringe';
import {listEnvironments} from '@/client/endpoints/environments';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../errors';
import {Output} from '../output';
import {PROMPTS, type Prompts} from '../prompts';
import {ClientProvider} from './ClientProvider';
import {RunContext} from './RunContext';
import {type EnvRef, SiteCache, type SiteRef} from './SiteCache';

type EnvironmentsResponse = components['schemas']['GetEnvironments-Response'];
export type ApiEnvironment = components['schemas']['Environment'];

function distance(a: string, b: string): number {
    let prev = Array.from({length: b.length + 1}, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(
                prev[j]! + 1,
                row[j - 1]! + 1,
                prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        prev = row;
    }
    return prev[b.length]!;
}

/** Closest candidates by Levenshtein distance, case-insensitive; far-off ones are dropped. */
export function suggest(
    input: string,
    candidates: string[],
    max = 3,
): string[] {
    const needle = input.toLowerCase();
    const threshold = Math.max(2, Math.ceil(needle.length / 2));
    return candidates
        .map((c) => ({c, d: distance(needle, c.toLowerCase())}))
        .filter((x) => x.d <= threshold)
        .sort((a, b) => a.d - b.d)
        .slice(0, max)
        .map((x) => x.c);
}

export function match<T>(
    input: string,
    items: T[],
    keys: (t: T) => string[],
): T[] {
    const needle = input.toLowerCase();
    const lowered = (t: T) => keys(t).map((k) => k.toLowerCase());
    const exact = items.filter((t) => lowered(t).includes(needle));
    if (exact.length > 0) return exact;
    return items.filter((t) => lowered(t).some((k) => k.startsWith(needle)));
}

/** Turns user input into a site and environment, prompting when interactive. */
@scoped(Lifecycle.ContainerScoped)
export class SiteResolver {
    constructor(
        private readonly ctx: RunContext,
        private readonly cache: SiteCache,
        private readonly output: Output,
        @inject(PROMPTS) private readonly prompts: Prompts,
        private readonly clients: ClientProvider,
    ) {}

    async resolveSite(
        input: string | undefined,
        opts: {fresh: boolean},
    ): Promise<SiteRef> {
        if (input === undefined && !this.ctx.interactive)
            throw new CliError('USAGE', 'Missing <site>');
        const sites = await this.cache.load(opts);
        if (input === undefined) {
            return this.prompts.search(
                'Select a site',
                sites.map((s) => ({
                    value: s,
                    label: `${s.displayName} (${s.name})`,
                })),
            );
        }
        const found = match(input, sites, (s) => [s.id, s.name, s.displayName]);
        if (found.length === 1) return found[0]!;
        if (found.length > 1)
            throw new CliError(
                'SITE_AMBIGUOUS',
                `Site "${input}" matches several sites`,
                found.map((s) => s.name),
            );
        throw new CliError(
            'SITE_NOT_FOUND',
            `No site matches "${input}"`,
            suggest(
                input,
                sites.map((s) => s.name),
            ),
        );
    }

    async resolveEnv(
        site: SiteRef,
        input: string | undefined,
        opts: {flag?: string; message?: string} = {},
    ): Promise<EnvRef> {
        const {flag = '--env', message = 'Select an environment'} = opts;
        const envs = site.environments;
        if (input === undefined) {
            if (envs.length === 1) {
                this.output.info(`Using environment ${envs[0]!.name}`);
                return envs[0]!;
            }
            const liveFirst = [...envs].sort(
                (a, b) => Number(b.isLive) - Number(a.isLive),
            );
            if (!this.ctx.interactive)
                throw new CliError(
                    'ENV_REQUIRED',
                    `Site ${site.name} has several environments; choose one`,
                    liveFirst.map((e) => `${flag} ${e.name}`),
                );
            return this.prompts.select(
                message,
                liveFirst.map((e) => ({value: e, label: e.displayName})),
            );
        }
        const found = match(input, envs, (e) => [e.id, e.name, e.displayName]);
        if (found.length === 1) return found[0]!;
        if (found.length > 1)
            throw new CliError(
                'ENV_NOT_FOUND',
                `Environment "${input}" matches several environments of ${site.name}`,
                found.map((e) => e.name),
            );
        throw new CliError(
            'ENV_NOT_FOUND',
            `Site ${site.name} has no environment "${input}"`,
            suggest(
                input,
                envs.map((e) => e.name),
            ),
        );
    }

    /** The environment as the API reports it (PHP version, CDN id, ...); always fresh. */
    async details(target: {
        site: SiteRef;
        env: EnvRef;
    }): Promise<ApiEnvironment> {
        const res = await this.clients
            .client()
            .send<EnvironmentsResponse>(listEnvironments(target.site.id));
        const env = res.site.environments.find((e) => e.id === target.env.id);
        if (!env)
            throw new Error(
                `Environment ${target.env.id} missing from the environments of ${target.site.name}`,
            );
        return env;
    }

    /** Write commands always resolve against fresh data so a stale cache never targets a wrong ID. */
    async resolveTarget(
        siteInput: string | undefined,
        envInput: string | undefined,
        opts: {write: boolean},
    ): Promise<{site: SiteRef; env: EnvRef}> {
        const site = await this.resolveSite(siteInput, {fresh: opts.write});
        const env = await this.resolveEnv(site, envInput);
        return {site, env};
    }
}
