import type {Command} from 'commander';
import {getSite, listSites} from '@/client/endpoints/sites';
import type {components} from '@/client/generated/openapi';
import {meta} from '../program';
import {loadSites, resolveSite} from '../resolve';
import type {Runtime} from '../runtime';

type ListResponse = components['schemas']['getSites-Response'];
type SiteResponse = components['schemas']['SiteById-Response'];

export function registerSites(program: Command, rt: Runtime): void {
    const sites = program
        .command('sites')
        .description('List and inspect Kinsta sites');

    meta(
        sites
            .command('list')
            .description('List the sites of the company')
            .option('--refresh', 'bypass the local site cache')
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl sites list\n  $ kinstactl sites list --refresh\n  $ kinstactl sites list --json',
            )
            .action(async (opts: {refresh?: boolean}) => {
                if (rt.json) {
                    // JSON is the raw API array, which the site cache does not hold.
                    const client = rt.client();
                    const res = await client.send<ListResponse>(
                        listSites(client.companyId, {
                            includeEnvironments: true,
                        }),
                    );
                    rt.output.table(res.company.sites, [], res.company.sites);
                    return;
                }
                const rows = await loadSites(rt, {fresh: !!opts.refresh});
                rt.output.table(rows, [
                    {header: 'NAME', value: (s) => s.name},
                    {header: 'DISPLAY NAME', value: (s) => s.displayName},
                    {
                        header: 'ENVIRONMENTS',
                        value: (s) =>
                            s.environments.map((e) => e.name).join(', '),
                    },
                    {header: 'ID', value: (s) => s.id},
                ]);
            }),
        {endpoints: ['GET /sites']},
    );

    meta(
        sites
            .command('get')
            .description('Show the details of a site')
            .argument('<site>', 'site name, display name or ID')
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl sites get klant-x\n  $ kinstactl sites get klant-x --json',
            )
            .action(async (input: string) => {
                const ref = await resolveSite(rt, input, {fresh: false});
                const {site} = await rt
                    .client()
                    .send<SiteResponse>(getSite(ref.id));
                rt.output.data(site, () =>
                    [
                        ['Name', site.name],
                        ['Display name', site.display_name],
                        ['ID', site.id],
                        ['Status', site.status],
                        ['Company', site.company_id],
                        [
                            'Environments',
                            site.environments.map((e) => e.name).join(', '),
                        ],
                    ]
                        .map(([k, v]) => `${k!.padEnd(13)}${v}`)
                        .join('\n'),
                );
            }),
        {endpoints: ['GET /sites', 'GET /sites/{site_id}']},
    );
}
