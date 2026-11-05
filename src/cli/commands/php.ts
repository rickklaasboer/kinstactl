import type {Command} from 'commander';
import type {components} from '@/client/generated/openapi';
import {listEnvironments} from '@/client/endpoints/environments';
import {modifyPhpVersion, restartPhp} from '@/client/endpoints/tools';
import {type ActionFlags, addActionFlags, runOperation} from '../progress';
import {meta} from '../program';
import {resolveTarget} from '../resolve';
import type {Runtime} from '../runtime';

type EnvironmentsResponse = components['schemas']['GetEnvironments-Response'];

export function registerPhp(program: Command, rt: Runtime): void {
    const php = program
        .command('php')
        .description('Manage the PHP engine of a site environment');

    meta(
        addActionFlags(
            php
                .command('restart')
                .description('Restart the PHP engine of an environment')
                .argument('<site>', 'site name, display name or ID')
                .option('--env <environment>', 'environment name or ID')
                .addHelpText(
                    'after',
                    '\nExamples:\n  $ kinstactl php restart klant-x --env live\n  $ kinstactl php restart klant-x --env live --dry-run',
                ),
            {dryRun: true, wait: true},
        ).action(
            async (siteInput: string, opts: {env?: string} & ActionFlags) => {
                const target = await resolveTarget(rt, siteInput, opts.env, {
                    write: true,
                });
                await runOperation(rt, {
                    title: 'Restart PHP',
                    spec: restartPhp(target.env.id),
                    target,
                    flags: opts,
                });
            },
        ),
        {endpoints: ['POST /sites/tools/restart-php']},
    );

    meta(
        addActionFlags(
            php
                .command('version')
                .description(
                    'Show the PHP version of an environment, or change it',
                )
                .argument('<site>', 'site name, display name or ID')
                .argument('[version]', 'PHP version to switch to, e.g. 8.3')
                .option('--env <environment>', 'environment name or ID')
                .option('--no-auto-update', 'opt out of automatic PHP updates')
                .addHelpText(
                    'after',
                    '\nExamples:\n  $ kinstactl php version klant-x --env live\n  $ kinstactl php version klant-x 8.3 --env staging\n  $ kinstactl php version klant-x 8.3 --env staging --no-auto-update --dry-run',
                ),
            {dryRun: true, wait: true},
        ).action(
            async (
                siteInput: string,
                version: string | undefined,
                opts: {env?: string; autoUpdate: boolean} & ActionFlags,
            ) => {
                if (version === undefined) {
                    const target = await resolveTarget(
                        rt,
                        siteInput,
                        opts.env,
                        {write: false},
                    );
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
                    // The API reports "php8.3"; show it in the form the write command takes.
                    const current =
                        env.container_info.php_engine_version.replace(
                            /^php/,
                            '',
                        );
                    rt.output.data(
                        {
                            site: target.site.name,
                            environment: target.env.name,
                            php_version: current,
                        },
                        () => current,
                    );
                    return;
                }
                const target = await resolveTarget(rt, siteInput, opts.env, {
                    write: true,
                });
                await runOperation(rt, {
                    title: `Change PHP version to ${version}`,
                    spec: modifyPhpVersion(
                        target.env.id,
                        version,
                        opts.autoUpdate === false ? true : undefined,
                    ),
                    target,
                    flags: opts,
                });
            },
        ),
        {
            endpoints: [
                'GET /sites/{site_id}/environments',
                'PUT /sites/tools/modify-php-version',
            ],
        },
    );
}
