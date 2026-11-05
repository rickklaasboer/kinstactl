import {injectable} from 'tsyringe';
import {removeExceptionRule} from '@/client/endpoints/security';
import type {EndpointKey} from '@/client/request';
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

type Options = {env?: string} & ActionFlags;

@injectable()
export class SecurityBotProtectionExceptionsDeleteCommand
    implements BaseCommand<Options>
{
    readonly name = 'security bot-protection exceptions delete';
    readonly description = 'Delete a bot protection exception rule';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'rule-id',
            required: true,
            description:
                'rule ID, see: security bot-protection exceptions list',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl security bot-protection exceptions delete klant-x ip:skip:192.0.2.1 --env live --yes',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'DELETE /sites/environments/{env_id}/bot-protection/exception-rules',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const ruleId = args.ruleId as string;
        await this.operations.run({
            title: `Delete exception rule ${ruleId}`,
            spec: removeExceptionRule(target.env.id, ruleId),
            target,
            flags: options,
            confirm: {
                action: `Delete exception rule ${ruleId}`,
                level: 'confirm',
            },
        });
    }
}
