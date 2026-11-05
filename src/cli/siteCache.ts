import type {Runtime} from './runtime';
import type {SiteRef} from './services/SiteCache';

export type {EnvRef, SiteRef} from './services/SiteCache';

/** Adapter for code that predates SiteCache. */
export function loadSites(
    rt: Runtime,
    opts: {fresh: boolean},
): Promise<SiteRef[]> {
    return rt.sites.load(opts);
}
