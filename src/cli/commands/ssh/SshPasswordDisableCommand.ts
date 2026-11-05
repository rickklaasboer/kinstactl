import {injectable} from 'tsyringe';
import {SshPasswordAccessCommand} from './SshPasswordAccessCommand';

@injectable()
export class SshPasswordDisableCommand extends SshPasswordAccessCommand {
    protected readonly enabled = false;
}
