import {injectable} from 'tsyringe';
import {listRegions} from '@/client/endpoints/account';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

@injectable()
export class CompanyRegionsCommand implements BaseCommand<object> {
    readonly name = 'company regions';
    readonly description = 'List the regions a site can be created in';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples = ['kinstactl company regions'];
    readonly endpoints: EndpointKey[] = ['GET /company/{id}/available-regions'];

    constructor(
        private readonly clients: ClientProvider,
        private readonly config: ConfigService,
        private readonly output: Output,
    ) {}

    async execute(_args: CommandArgs, _options: object): Promise<void> {
        const res = await this.clients
            .client()
            .send<components['schemas']['AvailableRegions']>(
                listRegions(this.config.credentials().companyId),
            );
        this.output.table(res.company.available_regions, [
            {header: 'REGION', value: (r) => r.region},
            {header: 'NAME', value: (r) => r.name},
        ]);
    }
}
