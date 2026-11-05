import {injectable} from 'tsyringe';
import type {Shell} from '../../completion/completionScript';
import {CompletionScriptCommand} from './CompletionScriptCommand';

@injectable()
export class CompletionBashCommand extends CompletionScriptCommand {
    protected readonly shell: Shell = 'bash';
}
