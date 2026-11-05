import {injectable} from 'tsyringe';
import {listApiKeys} from '@/client/endpoints/account';
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
export class CompanyApiKeysCommand implements BaseCommand<object> {
    readonly name = 'company api-keys';
    readonly description = 'List the API keys of the company';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples = ['kinstactl company api-keys'];
    readonly endpoints: EndpointKey[] = ['GET /company/{id}/api-keys'];

    constructor(
        private readonly clients: ClientProvider,
        private readonly config: ConfigService,
        private readonly output: Output,
    ) {}

    async execute(_args: CommandArgs, _options: object): Promise<void> {
        const res = await this.clients
            .client()
            .send<components['schemas']['CompanyApiKeysResponseSchema']>(
                listApiKeys(this.config.credentials().companyId),
            );
        this.output.table(res.api_keys, [
            {header: 'NAME', value: (k) => k.name},
            {
                header: 'STATUS',
                value: (k) => k.status,
                color: (k) => (k.status === 'active' ? 'green' : 'dim'),
            },
            {header: 'EXPIRES', value: (k) => k.expires_at ?? 'never'},
            {header: 'ID', value: (k) => k.id},
        ]);
    }
}
