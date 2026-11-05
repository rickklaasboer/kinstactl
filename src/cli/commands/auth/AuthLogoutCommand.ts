import {injectable} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {ConfigService} from '../../services/ConfigService';
import type {ArgumentDef, BaseCommand, OptionDef} from '../BaseCommand';

@injectable()
export class AuthLogoutCommand implements BaseCommand {
    readonly name = 'auth logout';
    readonly description = 'Remove a stored profile';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples = [
        'kinstactl auth logout',
        'kinstactl auth logout --profile work',
    ];
    readonly endpoints: EndpointKey[] = [];

    constructor(
        private readonly config: ConfigService,
        private readonly output: Output,
    ) {}

    execute(): void {
        const cfg = this.config.load();
        const name = this.config.selectedProfileName(cfg);
        if (!cfg.profiles[name]) {
            throw new CliError('USAGE', `Profile "${name}" not found`, [
                `Existing profiles: ${Object.keys(cfg.profiles).join(', ') || 'none'}`,
            ]);
        }
        delete cfg.profiles[name];
        if (cfg.defaultProfile === name) delete cfg.defaultProfile;
        this.config.save(cfg);
        this.output.success(`Removed profile "${name}"`, {removed: name});
    }
}
