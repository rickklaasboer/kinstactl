import type {Command} from 'commander';
import {
    listEnvironments,
    pushEnvironment,
} from '@/client/endpoints/environments';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../errors';
import {type ActionFlags, addActionFlags, runOperation} from '../progress';
import {meta} from '../program';
import {resolveEnv, resolveSite} from '../resolve';
import type {Runtime} from '../runtime';

type EnvironmentsResponse = components['schemas']['GetEnvironments-Response'];

interface PushOptions extends ActionFlags {
    from?: string;
    to?: string;
    db: boolean;
    files: boolean;
    searchReplace: boolean;
    path?: string[];
}

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

    meta(
        addActionFlags(
            env
                .command('push')
                .description(
                    'Push the database and/or files of one environment to another',
                )
                .argument('<site>', 'site name, display name or ID')
                .option('--from <env>', 'source environment')
                .option('--to <env>', 'target environment (gets overwritten)')
                .option('--no-db', 'do not push the database')
                .option('--no-files', 'do not push files')
                .option(
                    '--no-search-replace',
                    'do not run search and replace on the database',
                )
                .option(
                    '--path <path...>',
                    'push only these paths instead of all files',
                )
                .addHelpText(
                    'after',
                    '\nExamples:\n  $ kinstactl env push klant-x --from staging --to live\n  $ kinstactl env push klant-x --from staging --to live --no-db --path wp-content/themes --yes',
                ),
            {destructive: 'confirm'},
        ).action(async (input: string, opts: PushOptions) => {
            const site = await resolveSite(rt, input, {fresh: true});
            const from = await resolveEnv(rt, site, opts.from, {
                flag: '--from',
                message: 'Push from which environment?',
            });
            const to = await resolveEnv(rt, site, opts.to, {
                flag: '--to',
                message: 'Push to which environment?',
            });
            if (from.id === to.id)
                throw new CliError(
                    'USAGE',
                    '--from and --to must be different environments',
                );
            if (!opts.db && !opts.files)
                throw new CliError(
                    'USAGE',
                    'nothing to push: --no-db and --no-files together',
                );
            if (!opts.files && opts.path !== undefined)
                throw new CliError(
                    'USAGE',
                    '--path requires pushing files (drop --no-files)',
                );

            const what = [opts.db && 'database', opts.files && 'files'].filter(
                (w): w is string => typeof w === 'string',
            );
            const specific = opts.path !== undefined;
            await runOperation(rt, {
                title: `Push ${from.name} → ${to.name}`,
                spec: pushEnvironment(site.id, {
                    source_env_id: from.id,
                    target_env_id: to.id,
                    push_db: opts.db,
                    push_files: opts.files,
                    run_search_and_replace: opts.searchReplace,
                    push_files_option: specific
                        ? 'SPECIFIC_FILES'
                        : 'ALL_FILES',
                    ...(specific && {file_list: opts.path}),
                }),
                target: {site, env: to},
                flags: opts,
                confirm: {
                    action: `Push ${from.name} → ${to.name} (${what.join(', ')})`,
                    level: 'confirm',
                },
            });
        }),
        {
            endpoints: ['GET /sites', 'PUT /sites/{site_id}/environments'],
            destructive: 'confirm',
        },
    );
}
