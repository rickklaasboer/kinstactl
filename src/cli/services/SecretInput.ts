import {inject, Lifecycle, scoped} from 'tsyringe';
import {CliError} from '../errors';
import {IO, type Io} from '../io';
import {PROMPTS, type Prompts} from '../prompts';
import {RunContext} from './RunContext';

/** Reads a secret option value: literal, "-" for stdin, or a hidden prompt when interactive. */
@scoped(Lifecycle.ContainerScoped)
export class SecretInput {
    constructor(
        @inject(IO) private readonly io: Io,
        private readonly ctx: RunContext,
        @inject(PROMPTS) private readonly prompts: Prompts,
    ) {}

    async read(
        value: string | undefined,
        opts: {flag: string; label: string},
    ): Promise<string> {
        const {flag, label} = opts;
        if (value === '-') {
            if (!this.io.stdin)
                throw new CliError(
                    'USAGE',
                    `Reading the ${label} from stdin is not available here`,
                );
            const secret = (await this.io.stdin()).trim();
            if (!secret)
                throw new CliError(
                    'USAGE',
                    `stdin is empty; expected ${label}`,
                );
            return secret;
        }
        if (value !== undefined) return value;
        if (!this.ctx.interactive)
            throw new CliError(
                'USAGE',
                `No ${label} given and prompting is disabled`,
                [`Pass ${flag} <value> or ${flag} - (stdin)`],
            );
        return this.prompts.text(`Enter the ${label}`, {secret: true});
    }
}

/** For OperationRunner's `redact`: a copy of the body with each present key masked. */
export const redactKeys =
    (...keys: string[]) =>
    (body: unknown): unknown => {
        const copy = {...(body as Record<string, unknown>)};
        for (const key of keys) if (key in copy) copy[key] = '***';
        return copy;
    };
