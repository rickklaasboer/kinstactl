import {inject, Lifecycle, scoped} from 'tsyringe';
import type {Destructive} from '../commands/BaseCommand';
import {CliError} from '../errors';
import {PROMPTS, type Prompts} from '../prompts';
import type {ActionFlags} from './OperationRunner';
import {RunContext} from './RunContext';
import type {EnvRef, SiteRef} from './SiteCache';

export interface ConfirmArgs {
    action: string;
    site: SiteRef;
    env?: EnvRef;
    flags: ActionFlags;
    level: Destructive;
}

/** Gates destructive actions behind --yes, --confirm or a prompt. */
@scoped(Lifecycle.ContainerScoped)
export class ConfirmService {
    constructor(
        private readonly ctx: RunContext,
        @inject(PROMPTS) private readonly prompts: Prompts,
    ) {}

    /**
     * Resolves when the action may proceed; throws a CliError (exit 5) otherwise.
     * Operation commands must pass `confirm` to OperationRunner.run instead of calling this, so the order
     * dry-run, confirm, request is enforced there. Use this directly only for non-operation writes.
     */
    async confirmDestructive(args: ConfirmArgs): Promise<void> {
        const {action, site, env, flags, level} = args;
        const where = env
            ? `${site.displayName} (${env.name})`
            : site.displayName;

        if (level === 'confirm') {
            if (flags.yes) return;
            if (!this.ctx.interactive)
                throw new CliError(
                    'CONFIRMATION_REQUIRED',
                    `${action} on ${where} needs confirmation`,
                    ['Pass --yes'],
                );
            if (!(await this.prompts.confirm(`${action} on ${where}?`)))
                throw new CliError(
                    'CONFIRMATION_DECLINED',
                    'Confirmation declined',
                );
            return;
        }

        // Irreversible: --yes is deliberately not accepted, the site name must be typed or passed.
        const matches = (s: string) =>
            s.trim().toLowerCase() === site.name.toLowerCase();
        if (flags.confirm !== undefined) {
            if (matches(flags.confirm)) return;
            throw new CliError(
                'CONFIRMATION_REQUIRED',
                `--confirm "${flags.confirm}" does not match site ${site.name}`,
                [`--confirm ${site.name}`],
            );
        }
        if (!this.ctx.interactive)
            throw new CliError(
                'CONFIRMATION_REQUIRED',
                `${action} on ${where} is irreversible and needs the site name as confirmation`,
                [`--confirm ${site.name}`],
            );
        const typed = await this.prompts.text('Type the site name to confirm');
        if (!matches(typed))
            throw new CliError(
                'CONFIRMATION_DECLINED',
                'Typed name does not match the site name',
            );
    }
}
