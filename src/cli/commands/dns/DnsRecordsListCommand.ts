import {injectable} from 'tsyringe';
import {listDnsRecords} from '@/client/endpoints/dns';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';
import {DnsZoneService} from './DnsZoneService';

@injectable()
export class DnsRecordsListCommand implements BaseCommand<object> {
    readonly name = 'dns records list';
    readonly description = 'List the DNS records of a zone';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'zone',
            required: true,
            description: 'zone name or ID, see: dns zones',
        },
    ];
    readonly options: OptionDef[] = [];
    readonly examples = ['kinstactl dns records list example.com'];
    readonly endpoints: EndpointKey[] = [
        'GET /domains',
        'GET /domains/{domain_id}/dns-records',
    ];

    constructor(
        private readonly zones: DnsZoneService,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, _options: object): Promise<void> {
        const zone = await this.zones.find(args.zone as string);
        const res = await this.clients
            .client()
            .send<components['schemas']['DomainDnsRecordsResponseSchema']>(
                listDnsRecords(zone.id),
            );
        this.output.table(res.domain.dns_records, [
            {header: 'TYPE', value: (r) => r.type},
            {header: 'NAME', value: (r) => r.name},
            {header: 'TTL', value: (r) => String(r.ttl)},
            {
                header: 'VALUES',
                value: (r) => r.resource_records.map((v) => v.value).join(', '),
            },
        ]);
    }
}
