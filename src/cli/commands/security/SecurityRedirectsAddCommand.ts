import {injectable} from 'tsyringe';
import {
    type RedirectRule,
    updateRedirectRules,
} from '@/client/endpoints/security';
import type {EndpointKey} from '@/client/request';
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
import {parseRedirectType} from './RedirectRuleService';

type Options = {
    env?: string;
    type: RedirectRule['type'];
    domain?: string;
} & ActionFlags;

@injectable()
export class SecurityRedirectsAddCommand implements BaseCommand<Options> {
    readonly name = 'security redirects add';
    readonly description = 'Add a redirect rule';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {name: 'from', required: true, description: 'path to redirect from'},
        {name: 'to', required: true, description: 'path or URL to redirect to'},
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--type <type>',
            description: 'permanent (301) or redirect (302)',
            parse: parseRedirectType,
            default: 'permanent',
        },
        {
            flags: '--domain <domain>',
            description: 'only redirect this domain (default: all domains)',
        },
        ...actionOptions({wait: false}),
    ];
    readonly examples = [
        'kinstactl security redirects add my-site /old /new --env live',
        'kinstactl security redirects add my-site /old https://example.com/new --type redirect --domain example.com',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/redirect-rules',
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
        const newValue: RedirectRule = {
            domain: options.domain ?? null,
            from: args.from as string,
            to: args.to as string,
            type: options.type,
        };
        const sent = await this.operations.send({
            title: `Add redirect ${newValue.from}`,
            spec: updateRedirectRules(target.env.id, {
                action_type: 'NEW',
                new_value: newValue,
            }),
            target,
            flags: options,
        });
        if (sent === undefined) return;
        this.output.success('Redirect added', newValue);
    }
}
