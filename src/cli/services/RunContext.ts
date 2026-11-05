import {inject, Lifecycle, scoped} from 'tsyringe';
import {IO, type Io} from '../io';

export interface GlobalOptions {
    json?: boolean;
    /** Commander stores --no-input as input=false. */
    input?: boolean;
    profile?: string;
}

/** The global flags and clock of one run. */
@scoped(Lifecycle.ContainerScoped)
export class RunContext {
    json = false;
    interactive: boolean;
    profile?: string;
    readonly sleep?: (ms: number) => Promise<void>;

    constructor(@inject(IO) private readonly io: Io) {
        this.sleep = io.sleep;
        this.interactive = this.computeInteractive(true);
    }

    /** Applies the parsed global options; called once Commander has parsed them. */
    configure(opts: GlobalOptions): void {
        this.json = opts.json === true;
        this.profile = opts.profile;
        this.interactive = this.computeInteractive(opts.input !== false);
    }

    now(): number {
        return this.io.now ? this.io.now() : Date.now();
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
}
