import {KinstaClient} from '@/client/KinstaClient';
import {type Credentials, resolveCredentials} from './config';
import {Output} from './output';
import type {Prompts} from './prompts';

export interface Io {
    stdout: (s: string) => void;
    stderr: (s: string) => void;
    /** True when both stdin and stdout are TTYs. */
    isTTY: boolean;
    env: NodeJS.ProcessEnv;
    fetchFn?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    /** Clock in epoch milliseconds; injectable for the site cache TTL. */
    now?: () => number;
    prompts: Prompts;
    /** Reads all of stdin; used for `--api-key -`. */
    stdin?: () => Promise<string>;
}

export interface GlobalOptions {
    json?: boolean;
    /** Commander stores --no-input as input=false. */
    input?: boolean;
    profile?: string;
}

export class Runtime {
    json = false;
    interactive: boolean;
    profile?: string;
    readonly output: Output;
    readonly prompts: Prompts;
    readonly sleep?: (ms: number) => Promise<void>;
    private cachedCredentials?: Credentials;
    private cachedClient?: KinstaClient;

    constructor(readonly io: Io) {
        this.prompts = io.prompts;
        this.sleep = io.sleep;
        this.interactive = this.computeInteractive(true);
        this.output = new Output({
            stdout: io.stdout,
            stderr: io.stderr,
            json: () => this.json,
            debug: io.env.KINSTACTL_DEBUG === '1',
            color: io.isTTY && !io.env.NO_COLOR && io.env.TERM !== 'dumb',
        });
    }

    /** Applies the parsed global options; called once Commander has parsed them. */
    configure(opts: GlobalOptions): void {
        this.json = opts.json === true;
        this.profile = opts.profile;
        this.interactive = this.computeInteractive(opts.input !== false);
    }

    private computeInteractive(inputAllowed: boolean): boolean {
        const {isTTY, env} = this.io;
        return (
            isTTY &&
            inputAllowed &&
            env.KINSTACTL_NO_INPUT !== '1' &&
            env.CI !== 'true' &&
            !this.json
        );
    }

    now(): number {
        return this.io.now ? this.io.now() : Date.now();
    }

    credentials(): Credentials {
        this.cachedCredentials ??= resolveCredentials(this.io.env, {
            profile: this.profile,
        });
        return this.cachedCredentials;
    }

    client(): KinstaClient {
        if (!this.cachedClient) {
            const {apiKey, companyId} = this.credentials();
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
            sleep: this.io.sleep,
        });
    }
}
