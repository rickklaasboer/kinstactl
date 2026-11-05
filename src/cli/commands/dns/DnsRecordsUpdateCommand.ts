import {injectable} from 'tsyringe';
import {updateDnsRecord} from '@/client/endpoints/dns';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';
import {MIN_TTL, parseTtl} from './DnsRecordsAddCommand';
import {DnsZoneService} from './DnsZoneService';

type Options = {
    ttl?: number;
    add?: string[];
    remove?: string[];
} & ActionFlags;

@injectable()
export class DnsRecordsUpdateCommand implements BaseCommand<Options> {
    readonly name = 'dns records update';
    readonly description = 'Change the TTL or values of a DNS record';
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
        {
            flags: '--ttl <seconds>',
            description: `new time to live in seconds, at least ${MIN_TTL}`,
            parse: parseTtl,
        },
        {flags: '--add <value...>', description: 'values to add to the record'},
        {
            flags: '--remove <value...>',
            description: 'values to remove from the record',
        },
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl dns records update example.com A www --ttl 600',
        'kinstactl dns records update example.com A www --add 203.0.113.11 --remove 203.0.113.10',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /domains',
        'PUT /domains/{domain_id}/dns-records',
    ];

    constructor(
        private readonly zones: DnsZoneService,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        if (
            options.ttl === undefined &&
            options.add === undefined &&
            options.remove === undefined
        )
            throw new CliError('USAGE', 'Nothing to change', [
                'Pass --ttl, --add or --remove',
            ]);
        const type = args.type as string;
        const name = args.name as string;
        const zone = await this.zones.find(args.zone as string);
        await this.operations.run({
            title: `Update ${type} record ${name}`,
            spec: updateDnsRecord(zone.id, {
                type,
                name,
                ttl: options.ttl,
                add: options.add,
                remove: options.remove,
            }),
            flags: options,
        });
    }
}
