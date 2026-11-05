import {injectable} from 'tsyringe';
import {SftpUsersStatusCommand} from './SftpUsersStatusCommand';

@injectable()
export class SftpUsersDisableCommand extends SftpUsersStatusCommand {
    protected readonly enabled = false;
}
