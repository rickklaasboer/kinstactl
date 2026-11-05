import {injectable} from 'tsyringe';
import {WP_COMMAND_PATTERN} from '@/client/endpoints/tools';
import {runWpCli} from '@/client/endpoints/wp';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
    printOperationResult,
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
export class WpRunCommand implements BaseCommand<Options> {
    readonly name = 'wp run';
    readonly description = 'Run a WP-CLI command in an environment';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'command',
            required: true,
            description: 'the WP-CLI command, starting with "wp "',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl wp run my-site "wp plugin list" --env live --yes',
        'kinstactl wp run my-site "wp core version" --env staging --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/run-wp-cli-command',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const command = args.command!;
        if (!WP_COMMAND_PATTERN.test(command))
            throw new CliError(
                'USAGE',
                `command must start with "wp " and use only letters, digits and -_./:=@'`,
            );
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const result = await this.operations.run({
            title: 'Run WP-CLI command',
            spec: runWpCli(target.env.id, command),
            target,
            flags: options,
            confirm: {action: `Run "${command}"`, level: 'confirm'},
            quiet: true,
        });
        if (result !== undefined) printOperationResult(this.output, result);
    }
}
