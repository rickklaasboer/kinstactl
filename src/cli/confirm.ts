import type {Runtime} from './runtime';
import type {ConfirmArgs} from './services/ConfirmService';

export type {ConfirmArgs} from './services/ConfirmService';

/** Adapter for code that predates ConfirmService. */
export function confirmDestructive(
    rt: Runtime,
    args: ConfirmArgs,
): Promise<void> {
    return rt.confirmer.confirmDestructive(args);
}
