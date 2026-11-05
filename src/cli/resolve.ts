import {CliError} from './errors';
import type {Runtime} from './runtime';
import {type EnvRef, loadSites, type SiteRef} from './siteCache';

export {loadSites};
export type {EnvRef, SiteRef};

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

function match<T>(input: string, items: T[], keys: (t: T) => string[]): T[] {
    const needle = input.toLowerCase();
    const lowered = (t: T) => keys(t).map((k) => k.toLowerCase());
    const exact = items.filter((t) => lowered(t).includes(needle));
    if (exact.length > 0) return exact;
    return items.filter((t) => lowered(t).some((k) => k.startsWith(needle)));
}

export async function resolveSite(
    rt: Runtime,
    input: string | undefined,
    opts: {fresh: boolean},
): Promise<SiteRef> {
    if (input === undefined && !rt.interactive)
        throw new CliError('USAGE', 'Missing <site>');
    const sites = await loadSites(rt, opts);
    if (input === undefined) {
        return rt.prompts.search(
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

export async function resolveEnv(
    rt: Runtime,
    site: SiteRef,
    input: string | undefined,
    opts: {flag?: string; message?: string} = {},
): Promise<EnvRef> {
    const {flag = '--env', message = 'Select an environment'} = opts;
    const envs = site.environments;
    if (input === undefined) {
        if (envs.length === 1) {
            rt.output.info(`Using environment ${envs[0]!.name}`);
            return envs[0]!;
        }
        const liveFirst = [...envs].sort(
            (a, b) => Number(b.isLive) - Number(a.isLive),
        );
        if (!rt.interactive)
            throw new CliError(
                'ENV_REQUIRED',
                `Site ${site.name} has several environments; choose one`,
                liveFirst.map((e) => `${flag} ${e.name}`),
            );
        return rt.prompts.select(
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

/** Write commands always resolve against fresh data so a stale cache never targets a wrong ID. */
export async function resolveTarget(
    rt: Runtime,
    siteInput: string | undefined,
    envInput: string | undefined,
    opts: {write: boolean},
): Promise<{site: SiteRef; env: EnvRef}> {
    const site = await resolveSite(rt, siteInput, {fresh: opts.write});
    const env = await resolveEnv(rt, site, envInput);
    return {site, env};
}
