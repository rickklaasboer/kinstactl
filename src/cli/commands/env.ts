import type {Command} from 'commander';
import {listEnvironments} from '@/client/endpoints/environments';
import type {components} from '@/client/generated/openapi';
import {meta} from '../program';
import {resolveSite} from '../resolve';
import type {Runtime} from '../runtime';

type EnvironmentsResponse = components['schemas']['GetEnvironments-Response'];

export function registerEnv(program: Command, rt: Runtime): void {
    const env = program
        .command('env')
        .description('List and manage environments of a site');

    meta(
        env
            .command('list')
            .description('List the environments of a site')
            .argument('<site>', 'site name, display name or ID')
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl env list klant-x\n  $ kinstactl env list klant-x --json',
            )
            .action(async (input: string) => {
                const site = await resolveSite(rt, input, {fresh: false});
                const res = await rt
                    .client()
                    .send<EnvironmentsResponse>(listEnvironments(site.id));
                const rows = res.site.environments;
                rt.output.table(
                    rows,
                    [
                        {header: 'NAME', value: (e) => e.name},
                        {header: 'DISPLAY NAME', value: (e) => e.display_name},
                        {
                            header: 'PHP',
                            value: (e) => e.container_info.php_engine_version,
                        },
                        {
                            header: 'PRIMARY DOMAIN',
                            value: (e) => e.primaryDomain.name,
                        },
                        {header: 'ID', value: (e) => e.id},
                    ],
                    rows,
                );
            }),
        {
            endpoints: ['GET /sites', 'GET /sites/{site_id}/environments'],
        },
    );
}
