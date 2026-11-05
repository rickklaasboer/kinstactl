import {CliError} from './errors';
import type {ActionFlags} from './progress';
import type {Runtime} from './runtime';
import type {EnvRef, SiteRef} from './siteCache';

export interface ConfirmArgs {
    action: string;
    site: SiteRef;
    env?: EnvRef;
    flags: ActionFlags;
    level: 'confirm' | 'irreversible';
}

/** Resolves when the action may proceed; throws a CliError (exit 5) otherwise. */
export async function confirmDestructive(
    rt: Runtime,
    args: ConfirmArgs,
): Promise<void> {
    const {action, site, env, flags, level} = args;
    const where = env ? `${site.displayName} (${env.name})` : site.displayName;

    if (level === 'confirm') {
        if (flags.yes) return;
        if (!rt.interactive)
            throw new CliError(
                'CONFIRMATION_REQUIRED',
                `${action} on ${where} needs confirmation`,
                ['Pass --yes'],
            );
        if (!(await rt.prompts.confirm(`${action} on ${where}?`)))
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
    if (!rt.interactive)
        throw new CliError(
            'CONFIRMATION_REQUIRED',
            `${action} on ${where} is irreversible and needs the site name as confirmation`,
            [`--confirm ${site.name}`],
        );
    const typed = await rt.prompts.text('Type the site name to confirm');
    if (!matches(typed))
        throw new CliError(
            'CONFIRMATION_DECLINED',
            'Typed name does not match the site name',
        );
}
