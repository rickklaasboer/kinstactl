import {inject, Lifecycle, scoped} from 'tsyringe';
import {
    type ConfigFile,
    type Credentials,
    loadConfig,
    resolveCredentials,
    saveConfig,
    selectedProfileName,
} from '../config';
import {IO, type Io} from '../io';
import {RunContext} from './RunContext';

/** The config file and the credentials of one run. */
@scoped(Lifecycle.ContainerScoped)
export class ConfigService {
    private cachedCredentials?: Credentials;

    constructor(
        @inject(IO) private readonly io: Io,
        private readonly ctx: RunContext,
    ) {}

    load(): ConfigFile {
        return loadConfig(this.io.env);
    }

    save(cfg: ConfigFile): void {
        saveConfig(this.io.env, cfg);
    }

    selectedProfileName(cfg: ConfigFile): string {
        return selectedProfileName(
            this.io.env,
            {profile: this.ctx.profile},
            cfg,
        );
    }

    credentials(): Credentials {
        this.cachedCredentials ??= resolveCredentials(this.io.env, {
            profile: this.ctx.profile,
        });
        return this.cachedCredentials;
    }
}
