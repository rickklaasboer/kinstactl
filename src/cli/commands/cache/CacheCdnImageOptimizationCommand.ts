import {injectable} from 'tsyringe';
import {
    type ImageOptimizationType,
    setImageOptimization,
} from '@/client/endpoints/tools';
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

@injectable()
export class CacheCdnImageOptimizationCommand implements BaseCommand<Options> {
    readonly name = 'cache cdn image-optimization';
    readonly description =
        'Show or set the CDN image optimization of an environment';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'type',
            required: false,
            description: 'set this type; omit to show the current one',
            choices: ['off', 'lossy', 'lossless'],
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl cache cdn image-optimization klant-x --env live',
        'kinstactl cache cdn image-optimization klant-x lossy --env live',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/{site_id}/environments',
        'PUT /sites/cdn/image-optimization',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const type = args.type as ImageOptimizationType | undefined;
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: type !== undefined},
        );
        if (type === undefined) {
            const current = (await this.resolver.details(target))
                .image_optimization_type;
            this.output.data(
                {
                    site: target.site.name,
                    environment: target.env.name,
                    image_optimization_type: current,
                },
                () => current ?? '(none)',
            );
            return;
        }
        await this.operations.run({
            title: `Set image optimization to ${type}`,
            spec: setImageOptimization(target.env.id, type),
            target,
            flags: options,
        });
    }
}
