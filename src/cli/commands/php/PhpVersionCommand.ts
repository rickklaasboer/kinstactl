import {injectable} from 'tsyringe';
import {modifyPhpVersion} from '@/client/endpoints/tools';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
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

type Options = {env?: string; autoUpdate: boolean} & ActionFlags;

@injectable()
export class PhpVersionCommand implements BaseCommand<Options> {
    readonly name = 'php version';
    readonly description =
        'Show the PHP version of an environment, or change it';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'version',
            required: false,
            description: 'PHP version to switch to, e.g. 8.3',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--no-auto-update',
            description: 'opt out of automatic PHP updates',
        },
        ...actionOptions({dryRun: true, wait: true}),
    ];
    readonly examples = [
        'kinstactl php version my-site --env live',
        'kinstactl php version my-site 8.3 --env staging',
        'kinstactl php version my-site 8.3 --env staging --no-auto-update --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites/{site_id}/environments',
        'PUT /sites/tools/modify-php-version',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const version = args.version;
        if (version === undefined) {
            if (options.autoUpdate === false)
                throw new CliError('USAGE', '--no-auto-update needs a version');
            const target = await this.resolver.resolveTarget(
                args.site,
                options.env,
                {write: false},
            );
            const env = await this.resolver.details(target);
            // The API reports "php8.3"; show it in the form the write command takes.
            const current = env.container_info.php_engine_version.replace(
                /^php/,
                '',
            );
            this.output.data(
                {
                    site: target.site.name,
                    environment: target.env.name,
                    php_version: current,
                },
                () => current,
            );
            return;
        }
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        await this.operations.run({
            title: `Change PHP version to ${version}`,
            spec: modifyPhpVersion(
                target.env.id,
                version,
                options.autoUpdate === false ? true : undefined,
            ),
            target,
            flags: options,
        });
    }
}
