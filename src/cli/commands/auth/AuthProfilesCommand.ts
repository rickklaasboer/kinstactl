import {injectable} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ConfigService} from '../../services/ConfigService';
import type {ArgumentDef, BaseCommand, OptionDef} from '../BaseCommand';

@injectable()
export class AuthProfilesCommand implements BaseCommand {
    readonly name = 'auth profiles';
    readonly description = 'List stored profiles';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples = [
        'kinstactl auth profiles',
        'kinstactl auth profiles --json',
    ];
    readonly endpoints: EndpointKey[] = [];

    constructor(
        private readonly config: ConfigService,
        private readonly output: Output,
    ) {}

    execute(): void {
        const cfg = this.config.load();
        const rows = Object.entries(cfg.profiles).map(([name, p]) => ({
            name,
            companyId: p.companyId,
            keyName: p.keyName ?? null,
            default: name === (cfg.defaultProfile ?? 'default'),
        }));
        this.output.table(rows, [
            {header: 'PROFILE', value: (r) => r.name},
            {header: 'COMPANY', value: (r) => r.companyId},
            {header: 'KEY', value: (r) => r.keyName ?? '-'},
            {header: 'DEFAULT', value: (r) => (r.default ? '*' : '')},
        ]);
    }
}
