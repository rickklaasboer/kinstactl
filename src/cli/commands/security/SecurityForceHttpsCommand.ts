import {injectable} from 'tsyringe';
import {
    type ForceHttpsMode,
    getForceHttps,
    setForceHttps,
} from '@/client/endpoints/security';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
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

const MODES = {
    all: 'ENABLED_FOR_ALL',
    primary: 'ENABLED_REDIRECT_TO_PRIMARY',
    off: 'DISABLED',
} as const satisfies Record<string, ForceHttpsMode>;

const WORDS = Object.fromEntries(
    Object.entries(MODES).map(([word, mode]) => [mode, word]),
) as Record<ForceHttpsMode, keyof typeof MODES>;

@injectable()
export class SecurityForceHttpsCommand implements BaseCommand<Options> {
    readonly name = 'security force-https';
    readonly description =
        'Show or change how an environment forces HTTPS (all, primary, off)';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'mode',
            required: false,
            description:
                'all: redirect every domain, primary: redirect to the primary domain, off: do not force HTTPS',
            choices: Object.keys(MODES),
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({dryRun: true, wait: true}),
    ];
    readonly examples = [
        'kinstactl security force-https klant-x --env live',
        'kinstactl security force-https klant-x primary --env live',
        'kinstactl security force-https klant-x off --env staging --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/force-https-status',
        'POST /sites/environments/{env_id}/force-https-status',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const mode = args.mode as keyof typeof MODES | undefined;
        if (mode === undefined) {
            const target = await this.resolver.resolveTarget(
                args.site,
                options.env,
                {write: false},
            );
            const res = await this.clients
                .client()
                .send<components['schemas']['GetForceHttpsStatus-Response']>(
                    getForceHttps(target.env.id),
                );
            this.output.data(res, () => WORDS[res.force_https_status]);
            return;
        }
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        await this.operations.run({
            title: `Set force HTTPS to ${mode}`,
            spec: setForceHttps(target.env.id, MODES[mode]),
            target,
            flags: options,
        });
    }
}
