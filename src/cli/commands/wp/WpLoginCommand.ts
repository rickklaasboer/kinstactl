import {injectable} from 'tsyringe';
import {createWpAdminLoginLink} from '@/client/endpoints/wp';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type Options = {env?: string; email?: string} & ActionFlags;

@injectable()
export class WpLoginCommand implements BaseCommand<Options> {
    readonly name = 'wp login';
    readonly description = 'Create a one-time WordPress admin login link';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--email <email>',
            description: 'email of the WordPress admin user to log in as',
        },
        ...actionOptions({wait: false}),
    ];
    readonly examples = [
        'kinstactl wp login klant-x --env live --email admin@example.com',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/wpa-login-url',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        if (options.email === undefined)
            throw new CliError('USAGE', 'Missing --email');
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const res = await this.operations.send<
            components['schemas']['getWpAdminLoginLinkByEmail-Response']
        >({
            title: 'Create WordPress login link',
            spec: createWpAdminLoginLink(target.env.id, options.email),
            target,
            flags: options,
        });
        if (res === undefined) return;
        this.output.data(res, () => res.login_link);
    }
}
