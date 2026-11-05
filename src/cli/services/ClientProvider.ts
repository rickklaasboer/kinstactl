import {inject, Lifecycle, scoped} from 'tsyringe';
import {KinstaClient} from '@/client/KinstaClient';
import {IO, type Io} from '../io';
import {ConfigService} from './ConfigService';
import {RunContext} from './RunContext';

/** The API client of one run, built from its credentials. */
@scoped(Lifecycle.ContainerScoped)
export class ClientProvider {
    private cachedClient?: KinstaClient;

    constructor(
        @inject(IO) private readonly io: Io,
        private readonly ctx: RunContext,
        private readonly config: ConfigService,
    ) {}

    client(): KinstaClient {
        if (!this.cachedClient) {
            const {apiKey, companyId} = this.config.credentials();
            this.cachedClient = this.clientFor(apiKey, companyId);
        }
        return this.cachedClient;
    }

    /** A client for explicit credentials, e.g. a key that is not stored yet. */
    clientFor(apiKey: string, companyId: string): KinstaClient {
        return new KinstaClient({
            apiKey,
            companyId,
            fetchFn: this.io.fetchFn,
            sleep: this.ctx.sleep,
        });
    }
}
