import {injectable} from 'tsyringe';
import {CacheEdgeStatusCommand} from './CacheEdgeStatusCommand';

@injectable()
export class CacheEdgeDisableCommand extends CacheEdgeStatusCommand {
    protected readonly enabled = false;
}
