import {injectable} from 'tsyringe';
import {
    addExceptionRule,
    type ExceptionRuleAction,
    type ExceptionRuleType,
} from '@/client/endpoints/security';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
    printSentResult,
} from '../../services/OperationRunner';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

type Options = {env?: string} & ActionFlags;

@injectable()
export class SecurityBotProtectionExceptionsAddCommand
    implements BaseCommand<Options>
{
    readonly name = 'security bot-protection exceptions add';
    readonly description = 'Add a bot protection exception rule';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'type',
            required: true,
            description: 'what the rule matches on',
            choices: ['ip', 'path', 'user_agent', 'country'],
        },
        {
            name: 'action',
            required: true,
            description: 'what to do with matching traffic',
            choices: ['skip', 'challenge', 'block'],
        },
        {
            name: 'value',
            required: true,
            description: 'the value to match, e.g. an IP address',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({dryRun: true, wait: true}),
    ];
    readonly examples = [
        'kinstactl security bot-protection exceptions add klant-x ip skip 192.0.2.1 --env live',
        'kinstactl security bot-protection exceptions add klant-x country block NL --env live --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/bot-protection/exception-rules',
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
        const rule = {
            type: args.type as ExceptionRuleType,
            action: args.action as ExceptionRuleAction,
            value: args.value as string,
        };
        const title = `Add exception rule ${rule.type}:${rule.action}:${rule.value}`;
        const body = await this.operations.send<
            components['schemas']['AddBotProtectionExceptionRule-Response']
        >({
            title,
            spec: addExceptionRule(target.env.id, rule),
            target,
            flags: options,
        });
        if (body !== undefined) printSentResult(this.output, title, body);
    }
}
