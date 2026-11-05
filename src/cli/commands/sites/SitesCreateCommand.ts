import {inject, injectable} from 'tsyringe';
import {listRegions} from '@/client/endpoints/account';
import {createPlainSite, createSite} from '@/client/endpoints/sites';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {PROMPTS, type Prompts} from '../../prompts';
import {ClientProvider} from '../../services/ClientProvider';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {RunContext} from '../../services/RunContext';
import {SecretInput} from '../../services/SecretInput';
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
} from './WpInstallOptions';

type Region =
    components['schemas']['AvailableRegions']['company']['available_regions'][number];

type Options = {region?: string; plain?: boolean} & WpInstallFlags &
    ActionFlags;

@injectable()
export class SitesCreateCommand implements BaseCommand<Options> {
    readonly name = 'sites create';
    readonly description = 'Create a new site';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'display-name',
            required: true,
            description: 'display name of the new site',
        },
    ];
    readonly options: OptionDef[] = [
        {
            flags: '--region <region>',
            description:
                'Kinsta region, see: company regions; omitted on a TTY opens a picker',
        },
        {
            flags: '--plain',
            description: 'create an empty environment without WordPress',
        },
        ...WP_INSTALL_OPTIONS,
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl sites create "Klant Y" --region europe-west4 --admin-user admin --admin-email admin@klant-y.nl --admin-password -',
        'kinstactl sites create "Klant Y" --region europe-west4 --plain',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /company/{id}/available-regions',
        'POST /sites',
        'POST /sites/plain',
    ];

    constructor(
        private readonly clients: ClientProvider,
        private readonly operations: OperationRunner,
        private readonly secrets: SecretInput,
        private readonly ctx: RunContext,
        @inject(PROMPTS) private readonly prompts: Prompts,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const displayName = args.displayName as string;
        const client = this.clients.client();
        const region = await this.resolveRegion(
            client.companyId,
            options.region,
        );
        const spec = options.plain
            ? createPlainSite(client.companyId, displayName, region)
            : createSite({
                  company: client.companyId,
                  display_name: displayName,
                  region,
                  install_mode: 'new',
                  ...(await wpInstallFields(
                      options,
                      displayName,
                      this.secrets,
                  )),
              });
        await this.operations.run({
            title: `Create site ${displayName}`,
            spec,
            flags: options,
            redact: REDACT_WP_INSTALL,
        });
    }

    private async resolveRegion(
        companyId: string,
        given: string | undefined,
    ): Promise<string> {
        const {company} = await this.clients
            .client()
            .send<components['schemas']['AvailableRegions']>(
                listRegions(companyId),
            );
        const regions: Region[] = company.available_regions;
        const hints = regions.map((r) => `${r.region} (${r.name})`);
        if (given !== undefined) {
            if (!regions.some((r) => r.region === given))
                throw new CliError('USAGE', `Unknown region "${given}"`, hints);
            return given;
        }
        if (!this.ctx.interactive)
            throw new CliError('USAGE', 'Missing --region', hints);
        return this.prompts.select(
            'Select a region',
            regions.map((r) => ({value: r.region, label: r.name})),
        );
    }
}
