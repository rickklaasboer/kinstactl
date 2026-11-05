import {Argument, type Command, Option} from 'commander';
import type {DependencyContainer} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import type {
    BaseCommand,
    CommandArgs,
    CommandClass,
    Destructive,
    GroupDef,
    OptionDef,
} from './commands/BaseCommand';

export const ROOT_DESCRIPTION = 'Command line client for the Kinsta API';

export const GLOBAL_OPTIONS: OptionDef[] = [
    {flags: '--profile <name>', description: 'config profile to use'},
    {flags: '--json', description: 'print machine-readable JSON'},
    {flags: '--no-input', description: 'never prompt; fail instead'},
];

export function toOption(def: OptionDef): Option {
    const option = new Option(def.flags, def.description);
    if (def.parse) option.argParser(def.parse);
    if (def.default !== undefined) option.default(def.default);
    return option;
}

export interface CommandNode {
    name: string;
    path: string;
    description: string;
    arguments: {name: string; required: boolean; description: string}[];
    options: {flags: string; description: string}[];
    destructive: Destructive | null;
    endpoints: EndpointKey[];
    commands: CommandNode[];
}

function camelCase(name: string): string {
    return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function describeOptions(defs: OptionDef[]): CommandNode['options'] {
    return defs.map((o) => ({flags: o.flags, description: o.description}));
}

export class CommandRegistry {
    private resolved?: BaseCommand[];

    constructor(
        private readonly container: DependencyContainer,
        private readonly classes: CommandClass[],
        private readonly groups: GroupDef[],
    ) {}

    /** The command instances, resolved once, in class order. */
    commands(): BaseCommand[] {
        this.resolved ??= this.classes.map((cls) =>
            this.container.resolve(cls),
        );
        return this.resolved;
    }

    attach(program: Command, command: BaseCommand): Command {
        const parts = command.name.split(' ');
        const leafName = parts.pop() as string;
        let parent = program;
        const walked: string[] = [];
        for (const part of parts) {
            walked.push(part);
            parent = this.group(parent, part, walked.join(' '));
        }

        const leaf = parent.command(leafName).description(command.description);
        for (const def of command.arguments) {
            const argument = new Argument(
                def.required ? `<${def.name}>` : `[${def.name}]`,
                def.description,
            );
            if (def.choices) argument.choices(def.choices);
            if (def.default !== undefined) argument.default(def.default);
            leaf.addArgument(argument);
        }
        for (const def of command.options) leaf.addOption(toOption(def));
        leaf.addHelpText(
            'after',
            `\nExamples:\n${command.examples.map((e) => `  $ ${e}`).join('\n')}`,
        );
        leaf.action(async (...received: unknown[]) => {
            const args: CommandArgs = {};
            command.arguments.forEach((def, i) => {
                args[camelCase(def.name)] = received[i] as string | undefined;
            });
            const options = received[command.arguments.length];
            // Commander's parsed options are untyped; each command declares their shape.
            await command.execute(args, options as never);
        });
        return leaf;
    }

    tree(): CommandNode {
        const root: CommandNode = {
            name: 'kinstactl',
            path: '',
            description: ROOT_DESCRIPTION,
            arguments: [],
            options: describeOptions(GLOBAL_OPTIONS),
            destructive: null,
            endpoints: [],
            commands: [],
        };
        for (const command of this.commands()) {
            const parts = command.name.split(' ');
            let parent = root;
            parts.slice(0, -1).forEach((part, i) => {
                const path = parts.slice(0, i + 1).join(' ');
                let node = parent.commands.find((c) => c.name === part);
                if (!node) {
                    node = {
                        name: part,
                        path,
                        description: this.groupDescription(path),
                        arguments: [],
                        options: [],
                        destructive: null,
                        endpoints: [],
                        commands: [],
                    };
                    parent.commands.push(node);
                }
                parent = node;
            });
            parent.commands.push({
                name: parts[parts.length - 1] as string,
                path: command.name,
                description: command.description,
                arguments: command.arguments.map((a) => ({
                    name: a.name,
                    required: a.required,
                    description: a.description,
                })),
                options: [
                    ...describeOptions(command.options),
                    ...describeOptions(GLOBAL_OPTIONS),
                ],
                destructive: command.destructive ?? null,
                endpoints: command.endpoints,
                commands: [],
            });
        }
        return root;
    }

    private groupDescription(path: string): string {
        const group = this.groups.find((g) => g.path === path);
        if (!group)
            throw new Error(`No description for command group "${path}"`);
        return group.description;
    }

    private group(parent: Command, name: string, path: string): Command {
        const existing = parent.commands.find((c) => c.name() === name);
        if (existing) return existing;
        return parent.command(name).description(this.groupDescription(path));
    }
}
