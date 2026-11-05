import {injectable} from 'tsyringe';
import {createPmaLoginLink} from '@/client/endpoints/wp';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
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

type Options = {env?: string} & ActionFlags;

@injectable()
export class DbLoginCommand implements BaseCommand<Options> {
    readonly name = 'db login';
    readonly description = 'Create a phpMyAdmin login link';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({wait: false}),
    ];
    readonly examples = ['kinstactl db login klant-x --env live'];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/pma-login-token',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const res = await this.operations.send<
            components['schemas']['generatePhpMyAdminLoginLink-Response']
        >({
            title: 'Create phpMyAdmin login link',
            spec: createPmaLoginLink(target.env.id),
            target,
            flags: options,
        });
        if (res === undefined) return;
        this.output.data(
            {url: res.url, expires_at: res.expires_at},
            () => res.url,
        );
    }
}
