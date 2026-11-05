import {CliError} from '../errors';

/**
 * The list that results from --add and --remove on `current`. Throws USAGE, so nothing is sent, for
 * an entry that is already present, repeated in --add, in both --add and --remove, or not present
 * when removing. `label` names the list in the messages, e.g. 'the allowlist'.
 */
export function editList(
    current: string[],
    add: string[],
    remove: string[],
    label: string,
): string[] {
    const present = add.filter((ip) => current.includes(ip));
    if (present.length > 0)
        throw new CliError(
            'USAGE',
            `Already in ${label}: ${present.join(', ')}`,
        );
    const repeated = add.filter((ip, i) => add.indexOf(ip) !== i);
    if (repeated.length > 0)
        throw new CliError(
            'USAGE',
            `Repeated in --add: ${[...new Set(repeated)].join(', ')}`,
        );
    const both = add.filter((ip) => remove.includes(ip));
    if (both.length > 0)
        throw new CliError(
            'USAGE',
            `In both --add and --remove: ${both.join(', ')}`,
        );
    const unknown = remove.filter((ip) => !current.includes(ip));
    if (unknown.length > 0)
        throw new CliError('USAGE', `Not in ${label}: ${unknown.join(', ')}`);
    return [...current.filter((ip) => !remove.includes(ip)), ...add];
}
