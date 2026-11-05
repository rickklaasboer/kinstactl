import {injectable} from 'tsyringe';
import {
    type RedirectRule,
    updateRedirectRules,
} from '@/client/endpoints/security';
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
    Destructive,
    OptionDef,
} from '../BaseCommand';
import {parseRedirectType, RedirectRuleService} from './RedirectRuleService';

type Options = {
    env?: string;
    to?: string;
    type?: RedirectRule['type'];
    domain?: string;
    newDomain?: string;
} & ActionFlags;

@injectable()
export class SecurityRedirectsUpdateCommand implements BaseCommand<Options> {
    readonly name = 'security redirects update';
    readonly description = 'Change a redirect rule';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'from',
            required: true,
            description: 'the from path of the rule to change',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {flags: '--to <to>', description: 'new target path or URL'},
        {
            flags: '--type <type>',
            description: 'new type: permanent (301) or redirect (302)',
            parse: parseRedirectType,
        },
        {
            flags: '--domain <domain>',
            description:
                'select the rule of this domain when several share from',
        },
        {
            flags: '--new-domain <domain>',
            description: 'move the rule to this domain',
        },
        ...actionOptions({wait: false, destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl security redirects update my-site /old --to /newer --yes',
        'kinstactl security redirects update my-site /old --domain example.com --type redirect --yes',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/redirect-rules',
        'POST /sites/environments/{env_id}/redirect-rules',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly rules: RedirectRuleService,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        if (
            options.to === undefined &&
            options.type === undefined &&
            options.newDomain === undefined
        )
            throw new CliError(
                'USAGE',
                'Nothing to change: pass --to, --type or --new-domain',
            );
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const from = args.from as string;
        // The API types the stored type as a plain string; it only ever holds the two enum values.
        const existing = (await this.rules.find(
            target.env.id,
            from,
            options.domain,
        )) as RedirectRule;
        const newValue: RedirectRule = {
            ...existing,
            ...(options.to !== undefined ? {to: options.to} : {}),
            ...(options.type !== undefined ? {type: options.type} : {}),
            ...(options.newDomain !== undefined
                ? {domain: options.newDomain}
                : {}),
        };
        const sent = await this.operations.send({
            title: `Update redirect ${from}`,
            spec: updateRedirectRules(target.env.id, {
                action_type: 'UPDATE',
                rules_to_update: [existing],
                new_value: newValue,
            }),
            target,
            flags: options,
            confirm: {action: `Update redirect ${from}`, level: 'confirm'},
        });
        if (sent === undefined) return;
        this.output.success('Redirect updated', newValue);
    }
}
