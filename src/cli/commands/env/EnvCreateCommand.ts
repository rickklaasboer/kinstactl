import {injectable} from 'tsyringe';
import {
    createEnvironment,
    createPlainEnvironment,
} from '@/client/endpoints/environments';
import type {EndpointKey} from '@/client/request';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {SecretInput} from '../../services/SecretInput';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';
import {
    REDACT_WP_INSTALL,
    WP_INSTALL_OPTIONS,
    type WpInstallFlags,
    wpInstallFields,
} from '../sites/WpInstallOptions';

type Options = {plain?: boolean; premium?: boolean} & WpInstallFlags &
    ActionFlags;

@injectable()
export class EnvCreateCommand implements BaseCommand<Options> {
    readonly name = 'env create';
    readonly description = 'Create a new environment for a site';
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
        {
            flags: '--plain',
            description: 'create an empty environment without WordPress',
        },
        {
            flags: '--premium',
            description: 'create a premium staging environment',
        },
        ...WP_INSTALL_OPTIONS,
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl env create klant-x dev --admin-user admin --admin-email admin@klant-x.nl --admin-password -',
        'kinstactl env create klant-x dev --plain',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/{site_id}/environments',
        'POST /sites/{site_id}/environments/plain',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly secrets: SecretInput,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const displayName = args.displayName as string;
        const site = await this.resolver.resolveSite(args.site, {fresh: true});
        const isPremium = options.premium === true;
        const spec = options.plain
            ? createPlainEnvironment(site.id, displayName, isPremium)
            : createEnvironment(site.id, {
                  display_name: displayName,
                  is_premium: isPremium,
                  ...(await wpInstallFields(
                      options,
                      displayName,
                      this.secrets,
                  )),
              });
        await this.operations.run({
            title: `Create environment ${displayName}`,
            spec,
            target: {site},
            flags: options,
            redact: REDACT_WP_INSTALL,
        });
    }
}
