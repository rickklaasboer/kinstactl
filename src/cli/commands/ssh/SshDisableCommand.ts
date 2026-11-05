import {injectable} from 'tsyringe';
import {SshAccessCommand} from './SshAccessCommand';

@injectable()
export class SshDisableCommand extends SshAccessCommand {
    protected readonly enabled = false;
}
