import {InvalidArgumentError} from 'commander';
import {injectable} from 'tsyringe';
import {changeSitePhpAllocation} from '@/client/endpoints/sites';
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

type Options = {threads?: number; memory?: number} & ActionFlags;

function parsePositiveInteger(v: string): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1)
        throw new InvalidArgumentError('must be a positive integer');
    return n;
}

@injectable()
export class SitesPhpAllocationCommand implements BaseCommand<Options> {
    readonly name = 'sites php-allocation';
    readonly description =
        'Change the PHP allocation of the live and standard staging environments';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
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
        'kinstactl sites php-allocation my-site --threads 4 --memory 256',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/{site_id}/change-site-php-allocation',
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
        const site = await this.resolver.resolveSite(args.site, {fresh: true});
        await this.operations.run({
            title: 'Change PHP allocation',
            spec: changeSitePhpAllocation(site.id, {
                threadCount: options.threads,
                threadMemory: options.memory,
            }),
            target: {site},
            flags: options,
        });
    }
}
