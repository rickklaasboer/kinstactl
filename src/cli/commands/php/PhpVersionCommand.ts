import {injectable} from 'tsyringe';
import {listEnvironments} from '@/client/endpoints/environments';
import {modifyPhpVersion} from '@/client/endpoints/tools';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
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

type EnvironmentsResponse = components['schemas']['GetEnvironments-Response'];

@injectable()
export class PhpVersionCommand implements BaseCommand {
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
        'kinstactl php version klant-x --env live',
        'kinstactl php version klant-x 8.3 --env staging',
        'kinstactl php version klant-x 8.3 --env staging --no-auto-update --dry-run',
    ];
    readonly endpoints: BaseCommand['endpoints'] = [
        'GET /sites/{site_id}/environments',
        'PUT /sites/tools/modify-php-version',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(
        args: CommandArgs,
        options: Record<string, unknown>,
    ): Promise<void> {
        const opts = options as unknown as {
            env?: string;
            autoUpdate: boolean;
        } & ActionFlags;
        const version = args.version;
        if (version === undefined) {
            if (opts.autoUpdate === false)
                throw new CliError('USAGE', '--no-auto-update needs a version');
            const target = await this.resolver.resolveTarget(
                args.site,
                opts.env,
                {write: false},
            );
            const res = await this.clients
                .client()
                .send<EnvironmentsResponse>(listEnvironments(target.site.id));
            const env = res.site.environments.find(
                (e) => e.id === target.env.id,
            );
            if (!env)
                throw new Error(
                    `Environment ${target.env.id} missing from the environments of ${target.site.name}`,
                );
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
        const target = await this.resolver.resolveTarget(args.site, opts.env, {
            write: true,
        });
        await this.operations.run({
            title: `Change PHP version to ${version}`,
            spec: modifyPhpVersion(
                target.env.id,
                version,
                opts.autoUpdate === false ? true : undefined,
            ),
            target,
            flags: opts,
        });
    }
}
