import {injectable} from 'tsyringe';
import {SshAccessCommand} from './SshAccessCommand';

@injectable()
export class SshEnableCommand extends SshAccessCommand {
    protected readonly enabled = true;
}
