import {injectable} from 'tsyringe';
import {
    type SshPasswordExpiration,
    setSshPasswordExpiration,
} from '@/client/endpoints/ssh';
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

type Options = {env?: string} & ActionFlags;

const INTERVALS: Record<string, SshPasswordExpiration> = {
    '24h': 'hours_24',
    '7d': 'days_7',
    '30d': 'days_30',
    '90d': 'days_90',
    never: 'never',
};

@injectable()
export class SshPasswordExpirationCommand implements BaseCommand<Options> {
    readonly name = 'ssh password expiration';
    readonly description = 'Set how long the SSH/SFTP password stays valid';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'interval',
            required: true,
            description: 'validity of the password',
            choices: Object.keys(INTERVALS),
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({wait: false}),
    ];
    readonly examples = [
        'kinstactl ssh password expiration my-site 7d --env live',
        'kinstactl ssh password expiration my-site never --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/ssh/change-expiration-interval',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const interval = INTERVALS[args.interval as string];
        if (interval === undefined)
            throw new Error(`Unmapped interval: ${args.interval}`);
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const res = await this.operations.send({
            title: 'Change SSH password expiration',
            spec: setSshPasswordExpiration(target.env.id, interval),
            target,
            flags: options,
        });
        if (res === undefined) return;
        this.output.success(`Password expiration set to ${args.interval}`, {
            exp_interval: interval,
        });
    }
}
