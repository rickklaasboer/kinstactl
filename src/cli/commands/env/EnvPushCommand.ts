import {injectable} from 'tsyringe';
import {pushEnvironment} from '@/client/endpoints/environments';
import {CliError} from '../../errors';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

interface PushOptions extends ActionFlags {
    from?: string;
    to?: string;
    db: boolean;
    files: boolean;
    searchReplace: boolean;
    path?: string[];
}

@injectable()
export class EnvPushCommand implements BaseCommand {
    readonly name = 'env push';
    readonly description =
        'Push the database and/or files of one environment to another';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--from <env>', description: 'source environment'},
        {
            flags: '--to <env>',
            description: 'target environment (gets overwritten)',
        },
        {flags: '--no-db', description: 'do not push the database'},
        {flags: '--no-files', description: 'do not push files'},
        {
            flags: '--no-search-replace',
            description: 'do not run search and replace on the database',
        },
        {
            flags: '--path <path...>',
            description: 'push only these paths instead of all files',
        },
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl env push klant-x --from staging --to live',
        'kinstactl env push klant-x --from staging --to live --no-db --path wp-content/themes --yes',
    ];
    readonly endpoints = [
        'GET /sites' as const,
        'PUT /sites/{site_id}/environments' as const,
    ];
    readonly destructive = 'confirm' as const;

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(
        args: CommandArgs,
        options: Record<string, unknown>,
    ): Promise<void> {
        const opts = options as unknown as PushOptions;
        const site = await this.resolver.resolveSite(args.site, {fresh: true});
        const from = await this.resolver.resolveEnv(site, opts.from, {
            flag: '--from',
            message: 'Push from which environment?',
        });
        const to = await this.resolver.resolveEnv(site, opts.to, {
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
        await this.operations.run({
            title: `Push ${from.name} → ${to.name}`,
            spec: pushEnvironment(site.id, {
                source_env_id: from.id,
                target_env_id: to.id,
                push_db: opts.db,
                push_files: opts.files,
                run_search_and_replace: opts.searchReplace,
                push_files_option: specific ? 'SPECIFIC_FILES' : 'ALL_FILES',
                ...(specific && {file_list: opts.path}),
            }),
            target: {site, env: to},
            flags: opts,
            confirm: {
                action: `Push ${from.name} → ${to.name} (${what.join(', ')})`,
                level: 'confirm',
            },
        });
    }
}
