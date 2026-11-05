import {injectable} from 'tsyringe';
import {deleteDnsRecord} from '@/client/endpoints/dns';
import type {EndpointKey} from '@/client/request';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    Destructive,
    OptionDef,
} from '../BaseCommand';
import {DnsZoneService} from './DnsZoneService';

@injectable()
export class DnsRecordsDeleteCommand implements BaseCommand<ActionFlags> {
    readonly name = 'dns records delete';
    readonly description = 'Delete a DNS record from a zone';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'zone',
            required: true,
            description: 'zone name or ID, see: dns zones',
        },
        {name: 'type', required: true, description: 'record type, e.g. A'},
        {
            name: 'name',
            required: true,
            description: 'record name, e.g. www.example.com',
        },
    ];
    readonly options: OptionDef[] = [
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl dns records delete example.com A www',
        'kinstactl dns records delete example.com A www --yes',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /domains',
        'DELETE /domains/{domain_id}/dns-records',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly zones: DnsZoneService,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: ActionFlags): Promise<void> {
        const type = args.type as string;
        const name = args.name as string;
        const zone = await this.zones.find(args.zone as string);
        await this.operations.run({
            title: `Delete ${type} record ${name}`,
            spec: deleteDnsRecord(zone.id, type, name),
            flags: options,
            confirm: {
                action: `Delete ${type} record ${name}`,
                level: 'confirm',
                where: `zone ${zone.name}`,
            },
        });
    }
}
