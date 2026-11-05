import {injectable} from 'tsyringe';
import {
    changeWebrootSubfolder,
    WEBROOT_PATTERN,
} from '@/client/endpoints/environments';
import type {EndpointKey} from '@/client/request';
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

type Options = {
    env?: string;
    clearCache: boolean;
    refresh: boolean;
} & ActionFlags;

@injectable()
export class EnvWebrootCommand implements BaseCommand<Options> {
    readonly name = 'env webroot';
    readonly description = 'Change the webroot subfolder of an environment';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'subfolder',
            required: true,
            description: 'webroot subfolder, e.g. /public or /',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--no-clear-cache',
            description: 'do not clear all caches afterwards',
        },
        {
            flags: '--no-refresh',
            description: 'do not refresh the plugin and theme inventory',
        },
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl env webroot klant-x /public --env live',
        'kinstactl env webroot klant-x / --env staging --no-clear-cache',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/change-webroot-subfolder',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const subfolder = args.subfolder as string;
        if (!WEBROOT_PATTERN.test(subfolder))
            throw new CliError(
                'USAGE',
                `subfolder must look like /public or /, got "${subfolder}"`,
            );
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        await this.operations.run({
            title: `Change webroot to ${subfolder}`,
            spec: changeWebrootSubfolder(target.env.id, subfolder, {
                ...(!options.clearCache && {clearAllCache: false}),
                ...(!options.refresh && {refreshPluginsAndThemes: false}),
            }),
            target,
            flags: options,
        });
    }
}
