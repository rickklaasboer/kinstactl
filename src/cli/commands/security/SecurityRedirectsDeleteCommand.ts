import {injectable} from 'tsyringe';
import {
    type RedirectRule,
    type RedirectRulesUpdate,
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
import {RedirectRuleService} from './RedirectRuleService';

type Options = {env?: string; domain?: string; all?: boolean} & ActionFlags;

@injectable()
export class SecurityRedirectsDeleteCommand implements BaseCommand<Options> {
    readonly name = 'security redirects delete';
    readonly description = 'Delete a redirect rule, or all of them';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'from',
            required: false,
            description: 'the from path of the rule to delete',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--domain <domain>',
            description:
                'select the rule of this domain when several share from',
        },
        {flags: '--all', description: 'delete every redirect rule'},
        ...actionOptions({wait: false, destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl security redirects delete my-site /old --env live --yes',
        'kinstactl security redirects delete my-site --all --yes',
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
        const from = args.from;
        if ((from === undefined) === (options.all !== true))
            throw new CliError('USAGE', 'Pass either a from path or --all');
        if (options.all && options.domain !== undefined)
            throw new CliError(
                'USAGE',
                '--domain cannot be combined with --all',
            );

        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        let update: RedirectRulesUpdate;
        let action: string;
        if (from === undefined) {
            update = {action_type: 'DELETE_ALL'};
            action = 'Delete all redirect rules';
        } else {
            // The API types the stored type as a plain string; it only ever holds the two enum values.
            const existing = (await this.rules.find(
                target.env.id,
                from,
                options.domain,
            )) as RedirectRule;
            update = {action_type: 'DELETE', rules_to_update: [existing]};
            action = `Delete redirect ${from}`;
        }
        const sent = await this.operations.send({
            title: action,
            spec: updateRedirectRules(target.env.id, update),
            target,
            flags: options,
            confirm: {action, level: 'confirm'},
        });
        if (sent === undefined) return;
        this.output.success('Redirect rules deleted', {
            deleted: from ?? 'all',
        });
    }
}
