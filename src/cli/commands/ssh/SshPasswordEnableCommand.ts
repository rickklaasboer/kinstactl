import {injectable} from 'tsyringe';
import {SshPasswordAccessCommand} from './SshPasswordAccessCommand';

@injectable()
export class SshPasswordEnableCommand extends SshPasswordAccessCommand {
    protected readonly enabled = true;
}
