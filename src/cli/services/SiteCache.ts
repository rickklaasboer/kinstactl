import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {inject, Lifecycle, scoped} from 'tsyringe';
import {listSites} from '@/client/endpoints/sites';
import type {components} from '@/client/generated/openapi';
import {IO, type Io} from '../io';
import {Output} from '../output';
import {ClientProvider} from './ClientProvider';
import {RunContext} from './RunContext';

export interface EnvRef {
    id: string;
    name: string;
    displayName: string;
    isLive: boolean;
}

export interface SiteRef {
    id: string;
    name: string;
    displayName: string;
    environments: EnvRef[];
}

export const SITE_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheFile {
    fetchedAt: number;
    sites: SiteRef[];
}

export function siteCachePath(
    env: NodeJS.ProcessEnv,
    companyId: string,
): string {
    const base = env.XDG_CACHE_HOME || join(env.HOME || homedir(), '.cache');
    return join(base, 'kinstactl', `sites-${companyId}.json`);
}

function isString(v: unknown): v is string {
    return typeof v === 'string';
}

function isEnvRef(v: unknown): v is EnvRef {
    const e = v as EnvRef;
    return (
        typeof e === 'object' &&
        e !== null &&
        isString(e.id) &&
        isString(e.name) &&
        isString(e.displayName) &&
        typeof e.isLive === 'boolean'
    );
}

function isSiteRef(v: unknown): v is SiteRef {
    const s = v as SiteRef;
    return (
        typeof s === 'object' &&
        s !== null &&
        isString(s.id) &&
        isString(s.name) &&
        isString(s.displayName) &&
        Array.isArray(s.environments) &&
        s.environments.every(isEnvRef)
    );
}

function parseCache(raw: string): CacheFile {
    const parsed = JSON.parse(raw) as CacheFile;
    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof parsed.fetchedAt !== 'number' ||
        !Array.isArray(parsed.sites) ||
        !parsed.sites.every(isSiteRef)
    )
        throw new Error('unexpected shape');
    return parsed;
}

type ApiSite = components['schemas']['getSites-Site'];
type ApiResponse = components['schemas']['getSites-Response'];

function toSiteRef(s: ApiSite): SiteRef {
    return {
        id: s.id,
        name: s.name,
        displayName: s.display_name,
        environments: (s.environments ?? []).map((e) => ({
            id: e.id,
            name: e.name,
            displayName: e.display_name,
            isLive: e.name === 'live',
        })),
    };
}

/** The sites of the company, cached on disk for a few minutes. */
@scoped(Lifecycle.ContainerScoped)
export class SiteCache {
    constructor(
        @inject(IO) private readonly io: Io,
        private readonly ctx: RunContext,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    /** Sites of the company with their environments; `fresh` bypasses the cache and rewrites it. */
    async load(opts: {fresh: boolean}): Promise<SiteRef[]> {
        const client = this.clients.client();
        const path = siteCachePath(this.io.env, client.companyId);
        if (!opts.fresh) {
            const cached = this.read(path);
            if (cached && this.ctx.now() - cached.fetchedAt < SITE_CACHE_TTL_MS)
                return cached.sites;
        }
        const res = await client.send<ApiResponse>(
            listSites(client.companyId, {includeEnvironments: true}),
        );
        const sites = res.company.sites.map(toSiteRef);
        mkdirSync(join(path, '..'), {recursive: true});
        const file: CacheFile = {fetchedAt: this.ctx.now(), sites};
        writeFileSync(path, JSON.stringify(file));
        return sites;
    }

    private read(path: string): CacheFile | undefined {
        let raw: string;
        try {
            raw = readFileSync(path, 'utf8');
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT')
                return undefined;
            throw e;
        }
        try {
            return parseCache(raw);
        } catch (e) {
            // The cache is disposable: report it and refetch instead of failing.
            this.output.info(
                `Ignoring corrupt site cache ${path}: ${(e as Error).message}`,
            );
            return undefined;
        }
    }
}
