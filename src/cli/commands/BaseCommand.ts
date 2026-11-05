import type {EndpointKey} from '@/client/request';

export type Destructive = 'confirm' | 'irreversible';

export interface ArgumentDef {
    name: string;
    required: boolean;
    description: string;
    choices?: readonly string[];
    default?: string;
}

export interface OptionDef {
    flags: string;
    description: string;
    parse?: (value: string) => unknown;
    default?: unknown;
}

/**
 * The optional `[site]` argument, which opens the site picker when omitted.
 * Only valid as the last positional: with another positional after it,
 * Commander would put that value into `site`.
 */
export function siteArgument(
    description = 'site name, display name or ID',
): ArgumentDef {
    return {name: 'site', required: false, description};
}

/** Positional values by the camelCase of their name ('backup-id' becomes 'backupId'). */
export type CommandArgs = Record<string, string | undefined>;

/**
 * `O` is the shape of the parsed options; each command declares its own. The
 * default `never` makes plain `BaseCommand` the type that holds any command:
 * a method taking `Options` is assignable to one taking `never`.
 */
export interface BaseCommand<O extends object = never> {
    /** Full path, e.g. 'logs' or 'cache edge clear'. */
    readonly name: string;
    readonly description: string;
    readonly arguments: ArgumentDef[];
    /** In help order; action flags last. */
    readonly options: OptionDef[];
    /** Without the '$ ' prefix, e.g. 'kinstactl cache clear klant-x --env live'. */
    readonly examples: string[];
    readonly endpoints: EndpointKey[];
    readonly destructive?: Destructive;
    execute(args: CommandArgs, options: O): Promise<void> | void;
}

// biome-ignore lint/suspicious/noExplicitAny: tsyringe resolves constructors with any args
export type CommandClass = new (...deps: any[]) => BaseCommand;

/** A command group such as 'cache' or 'cache edge'. */
export interface GroupDef {
    path: string;
    description: string;
}
