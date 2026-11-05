import {InvalidArgumentError} from 'commander';
import {injectable} from 'tsyringe';
import {createDnsRecord} from '@/client/endpoints/dns';
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
import {DnsZoneService} from './DnsZoneService';

export const MIN_TTL = 300;

export function parseTtl(v: string): number {
    const n = Number(v);
    if (!Number.isInteger(n) || n < MIN_TTL)
        throw new InvalidArgumentError(
            `must be an integer of at least ${MIN_TTL} seconds`,
        );
    return n;
}

type Options = {value?: string[]; ttl: number} & ActionFlags;

@injectable()
export class DnsRecordsAddCommand implements BaseCommand<Options> {
    readonly name = 'dns records add';
    readonly description = 'Add a DNS record to a zone';
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
            flags: '--value <value...>',
            description:
                'record value; repeat the values for a round-robin record',
        },
        {
            flags: '--ttl <seconds>',
            description: `time to live in seconds, at least ${MIN_TTL}`,
            parse: parseTtl,
            default: MIN_TTL,
        },
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl dns records add example.com A www --value 203.0.113.10',
        'kinstactl dns records add example.com A @ --value 203.0.113.10 203.0.113.11 --ttl 600',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /domains',
        'POST /domains/{domain_id}/dns-records',
    ];

    constructor(
        private readonly zones: DnsZoneService,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        if (options.value === undefined || options.value.length === 0)
            throw new CliError('USAGE', 'Missing --value <value...>');
        const type = args.type as string;
        const name = args.name as string;
        const zone = await this.zones.find(args.zone as string);
        await this.operations.run({
            title: `Add ${type} record ${name}`,
            spec: createDnsRecord(zone.id, {
                type,
                name,
                ttl: options.ttl,
                values: options.value,
            }),
            flags: options,
        });
    }
}
