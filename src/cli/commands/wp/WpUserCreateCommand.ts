import {injectable} from 'tsyringe';
import {createWpAdminUser} from '@/client/endpoints/wp';
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
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

type Options = {
    env?: string;
    firstName?: string;
    lastName?: string;
} & ActionFlags;

@injectable()
export class WpUserCreateCommand implements BaseCommand<Options> {
    readonly name = 'wp user create';
    readonly description = 'Create a WordPress admin user';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {name: 'email', required: true, description: 'email of the new user'},
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {flags: '--first-name <name>', description: 'first name of the user'},
        {flags: '--last-name <name>', description: 'last name of the user'},
        ...actionOptions({wait: false}),
    ];
    readonly examples = [
        'kinstactl wp user create klant-x ann@example.com --env live --first-name Ann --last-name Lee',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/wpa-create-user',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const email = args.email!;
        if (options.firstName === undefined)
            throw new CliError('USAGE', 'Missing --first-name');
        if (options.lastName === undefined)
            throw new CliError('USAGE', 'Missing --last-name');
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const res = await this.operations.send<
            components['schemas']['createWpAdminUser-Response']
        >({
            title: 'Create WordPress admin user',
            spec: createWpAdminUser(target.env.id, {
                email,
                firstName: options.firstName,
                lastName: options.lastName,
            }),
            target,
            flags: options,
        });
        if (res === undefined) return;
        if (res.create_wp_admin_user !== true)
            throw new CliError('API_ERROR', 'Kinsta did not create the user');
        this.output.success(`Created WordPress admin user ${email}`, res);
    }
}
