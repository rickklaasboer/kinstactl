import {injectable} from 'tsyringe';
import {type CommandNode, CommandRegistry} from '../CommandRegistry';
import {Output} from '../output';
import type {ArgumentDef, BaseCommand, OptionDef} from './BaseCommand';

function renderList(node: CommandNode, depth: number): string[] {
    const args = node.arguments
        .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
        .join(' ');
    const label = [node.name, args].filter(Boolean).join(' ');
    const line = `${'  '.repeat(depth)}${label}${node.description ? `  ${node.description}` : ''}`;
    return [line, ...node.commands.flatMap((c) => renderList(c, depth + 1))];
}

@injectable()
export class CommandsCommand implements BaseCommand {
    readonly name = 'commands';
    readonly description =
        'List all commands, their options and the API endpoints they use';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples = ['kinstactl commands', 'kinstactl commands --json'];
    readonly endpoints = [];

    constructor(
        private readonly registry: CommandRegistry,
        private readonly output: Output,
    ) {}

    execute(): void {
        const tree = this.registry.tree();
        this.output.data(tree, () =>
            tree.commands.flatMap((c) => renderList(c, 0)).join('\n'),
        );
    }
}
