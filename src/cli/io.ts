import type {InjectionToken} from 'tsyringe';
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

export const IO: InjectionToken<Io> = Symbol('Io');
