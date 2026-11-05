import {injectable} from 'tsyringe';
import type {Shell} from '../../completion/completionScript';
import {CompletionScriptCommand} from './CompletionScriptCommand';

@injectable()
export class CompletionFishCommand extends CompletionScriptCommand {
    protected readonly shell: Shell = 'fish';
}
