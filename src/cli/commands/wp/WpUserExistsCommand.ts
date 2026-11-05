import {injectable} from 'tsyringe';
import {wpAdminUserExists} from '@/client/endpoints/wp';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

type Options = {env?: string};

@injectable()
export class WpUserExistsCommand implements BaseCommand<Options> {
    readonly name = 'wp user exists';
    readonly description = 'Check whether a WordPress admin user exists';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {name: 'email', required: true, description: 'email of the user'},
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl wp user exists my-site ann@example.com --env live',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/wpa-user-exists',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const email = args.email!;
        const {env} = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const res = await this.clients
            .client()
            .send<components['schemas']['HasWpAdminUserByEmail-Response']>(
                wpAdminUserExists(env.id, email),
            );
        this.output.data(
            {email, has_wp_admin_user: res.has_wp_admin_user},
            () => (res.has_wp_admin_user ? 'yes' : 'no'),
        );
    }
}
