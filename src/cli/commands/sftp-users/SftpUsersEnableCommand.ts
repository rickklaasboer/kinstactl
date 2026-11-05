import {injectable} from 'tsyringe';
import {SftpUsersStatusCommand} from './SftpUsersStatusCommand';

@injectable()
export class SftpUsersEnableCommand extends SftpUsersStatusCommand {
    protected readonly enabled = true;
}
