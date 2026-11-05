import {injectable} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';
import {DnsZoneService} from './DnsZoneService';

@injectable()
export class DnsZonesCommand implements BaseCommand<object> {
    readonly name = 'dns zones';
    readonly description = 'List the DNS zones of the company';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples = ['kinstactl dns zones', 'kinstactl dns zones --json'];
    readonly endpoints: EndpointKey[] = ['GET /domains'];

    constructor(
        private readonly zones: DnsZoneService,
        private readonly output: Output,
    ) {}

    async execute(_args: CommandArgs, _options: object): Promise<void> {
        this.output.table(await this.zones.list(), [
            {header: 'NAME', value: (z) => z.name},
            {header: 'ID', value: (z) => z.id},
            {header: 'SITE', value: (z) => z.site_id ?? ''},
            {header: 'ACTIVE', value: (z) => (z.is_active ? 'yes' : 'no')},
        ]);
    }
}
