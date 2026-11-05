import {inject, Lifecycle, scoped} from 'tsyringe';
import type {KinstaClient} from '@/client/KinstaClient';
import type {Credentials} from './config';
import {IO, type Io} from './io';
import {Output} from './output';
import {PROMPTS, type Prompts} from './prompts';
import {ClientProvider} from './services/ClientProvider';
import {ConfigService} from './services/ConfigService';
import {ConfirmService} from './services/ConfirmService';
import {OperationRunner} from './services/OperationRunner';
import {type GlobalOptions, RunContext} from './services/RunContext';
import {SiteCache} from './services/SiteCache';
import {SiteResolver} from './services/SiteResolver';

/** Facade over the run-scoped services, for code that predates them. */
@scoped(Lifecycle.ContainerScoped)
export class Runtime {
    constructor(
        @inject(IO) readonly io: Io,
        private readonly ctx: RunContext,
        readonly output: Output,
        @inject(PROMPTS) readonly prompts: Prompts,
        private readonly config: ConfigService,
        private readonly clients: ClientProvider,
        readonly sites: SiteCache,
        readonly resolver: SiteResolver,
        readonly confirmer: ConfirmService,
        readonly operations: OperationRunner,
    ) {}

    get json(): boolean {
        return this.ctx.json;
    }

    set json(value: boolean) {
        this.ctx.json = value;
    }

    get interactive(): boolean {
        return this.ctx.interactive;
    }

    get profile(): string | undefined {
        return this.ctx.profile;
    }

    get sleep(): ((ms: number) => Promise<void>) | undefined {
        return this.ctx.sleep;
    }

    configure(opts: GlobalOptions): void {
        this.ctx.configure(opts);
    }

    now(): number {
        return this.ctx.now();
    }

    credentials(): Credentials {
        return this.config.credentials();
    }

    client(): KinstaClient {
        return this.clients.client();
    }

    /** A client for explicit credentials, e.g. a key that is not stored yet. */
    clientFor(apiKey: string, companyId: string): KinstaClient {
        return this.clients.clientFor(apiKey, companyId);
    }
}
