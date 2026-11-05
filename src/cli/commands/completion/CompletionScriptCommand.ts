import {injectable} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import {CommandRegistry} from '../../CommandRegistry';
import {completionScript, type Shell} from '../../completion/completionScript';
import {Output} from '../../output';
import type {ArgumentDef, BaseCommand, OptionDef} from '../BaseCommand';

// Examples must start with 'kinstactl ', so bash lists the plain call first.
const INSTALL: Record<Shell, string[]> = {
    zsh: [
        // biome-ignore lint/suspicious/noTemplateCurlyInString: zsh syntax
        'kinstactl completion zsh > "${fpath[1]}/_kinstactl"',
    ],
    bash: ['kinstactl completion bash', 'eval "$(kinstactl completion bash)"'],
    fish: [
        'kinstactl completion fish > ~/.config/fish/completions/kinstactl.fish',
    ],
};

/** Prints the completion script of one shell; the subclass picks the shell. */
// The cast: injectable()'s type rejects abstract classes. The decorator is
// still needed so TypeScript emits design:paramtypes, which subclasses inherit.
@(injectable() as ClassDecorator)
export abstract class CompletionScriptCommand implements BaseCommand {
    protected abstract readonly shell: Shell;

    constructor(
        private readonly registry: CommandRegistry,
        private readonly output: Output,
    ) {}

    // Getters: a field initializer here would run before the subclass sets `shell`.
    get name(): string {
        return `completion ${this.shell}`;
    }

    get description(): string {
        return `Print the ${this.shell} completion script`;
    }

    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];

    get examples(): string[] {
        return INSTALL[this.shell];
    }

    readonly endpoints: EndpointKey[] = [];

    execute(): void {
        const shell = this.shell;
        const script = completionScript(shell, this.registry.tree());
        this.output.data({shell, script}, () => script);
    }
}
