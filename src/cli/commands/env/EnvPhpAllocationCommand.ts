import {InvalidArgumentError} from 'commander';
import {injectable} from 'tsyringe';
import {changeEnvironmentPhpAllocation} from '@/client/endpoints/environments';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
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

type Options = {env?: string; threads?: number; memory?: number} & ActionFlags;

function parsePositiveInteger(v: string): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1)
        throw new InvalidArgumentError('must be a positive integer');
    return n;
}

@injectable()
export class EnvPhpAllocationCommand implements BaseCommand<Options> {
    readonly name = 'env php-allocation';
    readonly description =
        'Change the PHP allocation of a premium staging environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--threads <n>',
            description: 'number of PHP threads',
            parse: parsePositiveInteger,
        },
        {
            flags: '--memory <mb>',
            description: 'memory per PHP thread in MB',
            parse: parsePositiveInteger,
        },
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl env php-allocation my-site --env staging --threads 4 --memory 256',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/change-environment-php-allocation',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        if (options.threads === undefined)
            throw new CliError('USAGE', 'Missing --threads');
        if (options.memory === undefined)
            throw new CliError('USAGE', 'Missing --memory');
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        await this.operations.run({
            title: 'Change PHP allocation',
            spec: changeEnvironmentPhpAllocation(target.env.id, {
                threadCount: options.threads,
                threadMemory: options.memory,
            }),
            target,
            flags: options,
        });
    }
}
