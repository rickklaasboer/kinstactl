import type {Runtime} from './runtime';
import type {EnvRef, SiteRef} from './services/SiteCache';

export {suggest} from './services/SiteResolver';
export {loadSites} from './siteCache';
export type {EnvRef, SiteRef};

/** Adapters for code that predates SiteResolver. */
export function resolveSite(
    rt: Runtime,
    input: string | undefined,
    opts: {fresh: boolean},
): Promise<SiteRef> {
    return rt.resolver.resolveSite(input, opts);
}

export function resolveEnv(
    rt: Runtime,
    site: SiteRef,
    input: string | undefined,
    opts: {flag?: string; message?: string} = {},
): Promise<EnvRef> {
    return rt.resolver.resolveEnv(site, input, opts);
}

export function resolveTarget(
    rt: Runtime,
    siteInput: string | undefined,
    envInput: string | undefined,
    opts: {write: boolean},
): Promise<{site: SiteRef; env: EnvRef}> {
    return rt.resolver.resolveTarget(siteInput, envInput, opts);
}
