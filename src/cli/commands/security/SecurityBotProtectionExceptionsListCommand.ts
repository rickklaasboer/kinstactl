import {injectable} from 'tsyringe';
import {listExceptionRules} from '@/client/endpoints/security';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type Options = {env?: string};
type Response = {
    bot_protection:
        | components['schemas']['BotProtectionExceptionRulesSchema']
        | null;
};

@injectable()
export class SecurityBotProtectionExceptionsListCommand
    implements BaseCommand<Options>
{
    readonly name = 'security bot-protection exceptions list';
    readonly description =
        'List the bot protection exception rules of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl security bot-protection exceptions list my-site --env live',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/bot-protection/exception-rules',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const res = await this.clients
            .client()
            .send<Response>(listExceptionRules(target.env.id));
        const rules = res.bot_protection?.exception_rules ?? [];
        this.output.table(
            rules,
            [
                {header: 'ID', value: (r) => r.id},
                {header: 'TYPE', value: (r) => r.type},
                {header: 'ACTION', value: (r) => r.action},
                {header: 'VALUE', value: (r) => r.value},
            ],
            res,
        );
        if (res.bot_protection?.has_custom_waf_rules)
            this.output.info('This environment has custom WAF rules');
    }
}
