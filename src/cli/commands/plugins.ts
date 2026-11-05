import type {Command} from 'commander';
import pc from 'picocolors';
import type {components} from '@/client/generated/openapi';
import {
    bulkUpdatePlugins,
    bulkUpdateThemes,
    listPlugins,
    listThemes,
    updatePlugin,
    updateTheme,
} from '@/client/endpoints/plugins';
import type {EndpointKey, RequestSpec} from '@/client/request';
import {CliError} from '../errors';
import {addActionFlags, type ActionFlags, runOperation} from '../progress';
import {meta} from '../program';
import {resolveTarget} from '../resolve';
import type {Runtime} from '../runtime';

type Schemas = components['schemas'];
type WpItem =
    Schemas['GetWpSiteEnvironmentWordPressPlugins-Response']['environment']['plugins']['items'][number];

interface Kind {
    /** Command name, plural. */
    command: 'plugins' | 'themes';
    /** Singular, for messages. */
    noun: 'plugin' | 'theme';
    list: (envId: string) => RequestSpec;
    update: (envId: string, name: string, version: string) => RequestSpec;
    bulk: (envId: string, names: string[]) => RequestSpec;
    endpoints: {
        list: EndpointKey;
        update: EndpointKey;
        bulk: EndpointKey;
    };
}

const KINDS: Kind[] = [
    {
        command: 'plugins',
        noun: 'plugin',
        list: listPlugins,
        update: updatePlugin,
        bulk: bulkUpdatePlugins,
        endpoints: {
            list: 'GET /sites/environments/{env_id}/wp-plugins',
            update: 'PUT /sites/environments/{env_id}/plugins',
            bulk: 'PUT /sites/environments/{env_id}/plugins/bulk-update',
        },
    },
    {
        command: 'themes',
        noun: 'theme',
        list: listThemes,
        update: updateTheme,
        bulk: bulkUpdateThemes,
        endpoints: {
            list: 'GET /sites/environments/{env_id}/wp-themes',
            update: 'PUT /sites/environments/{env_id}/themes',
            bulk: 'PUT /sites/environments/{env_id}/themes/bulk-update',
        },
    },
];

const hasUpdate = (i: WpItem) => i.update === 'available';

async function fetchItems(
    rt: Runtime,
    kind: Kind,
    envId: string,
): Promise<WpItem[]> {
    const res = await rt.client().send<{
        environment: Record<Kind['command'], {items: WpItem[]}>;
    }>(kind.list(envId));
    return res.environment[kind.command].items;
}

function registerKind(program: Command, rt: Runtime, kind: Kind): void {
    const {command, noun} = kind;
    const group = program
        .command(command)
        .description(`List and update WordPress ${command}`);

    meta(
        group
            .command('list')
            .description(`List the ${command} of an environment`)
            .argument('<site>', 'site name or ID')
            .option('--env <env>', 'environment name or ID')
            .option('--updates', `only ${command} with an update available`)
            .addHelpText(
                'after',
                `\nExamples:\n  $ kinstactl ${command} list klant-x --env live\n  $ kinstactl ${command} list klant-x --env live --updates`,
            )
            .action(
                async (
                    siteInput: string,
                    opts: {env?: string; updates?: boolean},
                ) => {
                    const {env} = await resolveTarget(rt, siteInput, opts.env, {
                        write: false,
                    });
                    const all = await fetchItems(rt, kind, env.id);
                    const items = opts.updates ? all.filter(hasUpdate) : all;
                    rt.output.table(
                        items,
                        [
                            {header: 'NAME', value: (i) => i.name},
                            {header: 'STATUS', value: (i) => i.status},
                            {header: 'VERSION', value: (i) => i.version},
                            {
                                header: 'UPDATE',
                                value: (i) =>
                                    hasUpdate(i)
                                        ? (i.update_version ?? i.update)
                                        : '',
                                color: () => pc.yellow,
                            },
                            {
                                header: 'VULNERABLE',
                                value: (i) =>
                                    i.is_version_vulnerable ? 'yes' : '',
                                color: () => pc.red,
                            },
                        ],
                        items,
                    );
                },
            ),
        {endpoints: [kind.endpoints.list]},
    );

    const update = group
        .command('update')
        .description(`Update one ${noun}, or all ${command} with an update`)
        .argument('<site>', 'site name or ID')
        .argument('[name]', `${noun} name`)
        .option('--env <env>', 'environment name or ID')
        .option('--all', `update every ${noun} that has an update`)
        .addHelpText(
            'after',
            `\nExamples:\n  $ kinstactl ${command} update klant-x ${noun === 'plugin' ? 'akismet' : 'twentytwentyfour'} --env live\n  $ kinstactl ${command} update klant-x --all --env live --dry-run`,
        );
    addActionFlags(update, {});
    meta(
        update.action(
            async (
                siteInput: string,
                name: string | undefined,
                opts: ActionFlags & {env?: string; all?: boolean},
            ) => {
                if (name === undefined && !opts.all)
                    throw new CliError('USAGE', `no ${noun} given`, [
                        `pass a ${noun} name or --all`,
                    ]);
                if (name !== undefined && opts.all)
                    throw new CliError(
                        'USAGE',
                        `pass either a ${noun} name or --all, not both`,
                    );
                const target = await resolveTarget(rt, siteInput, opts.env, {
                    write: true,
                });
                const items = await fetchItems(rt, kind, target.env.id);

                if (name !== undefined) {
                    const item = items.find((i) => i.name === name);
                    if (!item)
                        throw new CliError(
                            'USAGE',
                            `${noun} not found: ${name}`,
                        );
                    if (!hasUpdate(item))
                        throw new CliError(
                            'USAGE',
                            `${noun} ${name} is already up to date`,
                        );
                    if (item.update_version === null)
                        throw new CliError(
                            'API_ERROR',
                            `${noun} ${name} has an update but Kinsta gave no version`,
                        );
                    await runOperation(rt, {
                        title: `Update ${noun} ${name}`,
                        spec: kind.update(
                            target.env.id,
                            name,
                            item.update_version,
                        ),
                        target,
                        flags: opts,
                    });
                    return;
                }

                const names = items.filter(hasUpdate).map((i) => i.name);
                if (names.length === 0) {
                    rt.output.success(`All ${command} are up to date`, {
                        updated: [],
                    });
                    return;
                }
                await runOperation(rt, {
                    title: `Update ${names.length} ${command}`,
                    spec: kind.bulk(target.env.id, names),
                    target,
                    flags: opts,
                });
            },
        ),
        {
            endpoints: [
                kind.endpoints.list,
                kind.endpoints.update,
                kind.endpoints.bulk,
            ],
        },
    );
}

export function registerPlugins(program: Command, rt: Runtime): void {
    for (const kind of KINDS) registerKind(program, rt, kind);
}
