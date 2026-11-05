import type {Command} from 'commander';
import type {components} from '@/client/generated/openapi';
import {listEnvironments} from '@/client/endpoints/environments';
import {
    clearCache,
    clearCdnCache,
    clearEdgeCache,
} from '@/client/endpoints/tools';
import {CliError} from '../errors';
import {type ActionFlags, addActionFlags, runOperation} from '../progress';
import {meta} from '../program';
import {resolveTarget} from '../resolve';
import type {Runtime} from '../runtime';

type EnvironmentsResponse = components['schemas']['GetEnvironments-Response'];

export function registerCache(program: Command, rt: Runtime): void {
    const cache = program
        .command('cache')
        .description('Clear the caches of a site environment');

    meta(
        addActionFlags(
            cache
                .command('clear')
                .description('Clear the site cache of an environment')
                .argument('<site>', 'site name, display name or ID')
                .option('--env <environment>', 'environment name or ID')
                .addHelpText(
                    'after',
                    '\nExamples:\n  $ kinstactl cache clear klant-x --env live\n  $ kinstactl cache clear klant-x --env staging --dry-run',
                ),
            {dryRun: true, wait: true},
        ).action(
            async (siteInput: string, opts: {env?: string} & ActionFlags) => {
                const target = await resolveTarget(rt, siteInput, opts.env, {
                    write: true,
                });
                await runOperation(rt, {
                    title: 'Clear cache',
                    spec: clearCache(target.env.id),
                    target,
                    flags: opts,
                });
            },
        ),
        {endpoints: ['POST /sites/tools/clear-cache']},
    );

    const edge = cache.command('edge').description('Edge cache');
    meta(
        addActionFlags(
            edge
                .command('clear')
                .description('Clear the edge cache of an environment')
                .argument('<site>', 'site name, display name or ID')
                .option('--env <environment>', 'environment name or ID')
                .option('--url <url>', 'clear only this URL')
                .option(
                    '--subdirectories',
                    'also clear the subdirectories of --url',
                )
                .addHelpText(
                    'after',
                    '\nExamples:\n  $ kinstactl cache edge clear klant-x --env live\n  $ kinstactl cache edge clear klant-x --env live --url https://example.com/blog/ --subdirectories',
                ),
            {dryRun: true, wait: true},
        ).action(
            async (
                siteInput: string,
                opts: {
                    env?: string;
                    url?: string;
                    subdirectories?: boolean;
                } & ActionFlags,
            ) => {
                const target = await resolveTarget(rt, siteInput, opts.env, {
                    write: true,
                });
                await runOperation(rt, {
                    title: 'Clear edge cache',
                    spec: clearEdgeCache(target.env.id, {
                        url: opts.url,
                        clearSubdirectories: opts.subdirectories,
                    }),
                    target,
                    flags: opts,
                });
            },
        ),
        {endpoints: ['POST /sites/edge-caching/clear']},
    );

    const cdn = cache.command('cdn').description('CDN cache');
    meta(
        addActionFlags(
            cdn
                .command('clear')
                .description('Clear the CDN cache of an environment')
                .argument('<site>', 'site name, display name or ID')
                .option('--env <environment>', 'environment name or ID')
                .addHelpText(
                    'after',
                    '\nExamples:\n  $ kinstactl cache cdn clear klant-x --env live\n  $ kinstactl cache cdn clear klant-x --env live --dry-run',
                ),
            {dryRun: true, wait: true},
        ).action(
            async (siteInput: string, opts: {env?: string} & ActionFlags) => {
                const target = await resolveTarget(rt, siteInput, opts.env, {
                    write: true,
                });
                const res = await rt
                    .client()
                    .send<EnvironmentsResponse>(
                        listEnvironments(target.site.id),
                    );
                const env = res.site.environments.find(
                    (e) => e.id === target.env.id,
                );
                if (!env)
                    throw new Error(
                        `Environment ${target.env.id} missing from the environments of ${target.site.name}`,
                    );
                if (env.cdn_cache_id === null)
                    throw new CliError(
                        'USAGE',
                        `CDN is not enabled for ${target.site.name} (${target.env.name})`,
                    );
                await runOperation(rt, {
                    title: 'Clear CDN cache',
                    spec: clearCdnCache(target.env.id, env.cdn_cache_id),
                    target,
                    flags: opts,
                });
            },
        ),
        {
            endpoints: [
                'GET /sites/{site_id}/environments',
                'POST /sites/cdn/clear-cache',
            ],
        },
    );
}
