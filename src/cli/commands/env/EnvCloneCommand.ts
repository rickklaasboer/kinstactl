import {injectable} from 'tsyringe';
import {cloneEnvironment} from '@/client/endpoints/environments';
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
    OptionDef,
} from '../BaseCommand';

type Options = {from?: string; premium?: boolean} & ActionFlags;

@injectable()
export class EnvCloneCommand implements BaseCommand<Options> {
    readonly name = 'env clone';
    readonly description =
        'Clone an environment into a new environment of the same site';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'display-name',
            required: true,
            description: 'display name of the new environment',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--from <environment>', description: 'environment to clone'},
        {
            flags: '--premium',
            description: 'create a premium staging environment',
        },
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl env clone klant-x dev --from live',
        'kinstactl env clone klant-x dev --from live --premium',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/{site_id}/environments/clone',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const displayName = args.displayName as string;
        const site = await this.resolver.resolveSite(args.site, {fresh: true});
        const source = await this.resolver.resolveEnv(site, options.from, {
            flag: '--from',
            message: 'Clone which environment?',
        });
        await this.operations.run({
            title: `Clone ${source.name} to ${displayName}`,
            spec: cloneEnvironment(site.id, {
                displayName,
                isPremium: options.premium === true,
                sourceEnvId: source.id,
            }),
            target: {site},
            flags: options,
        });
    }
}
