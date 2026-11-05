import {injectable} from 'tsyringe';
import {CacheEdgeStatusCommand} from './CacheEdgeStatusCommand';

@injectable()
export class CacheEdgeEnableCommand extends CacheEdgeStatusCommand {
    protected readonly enabled = true;
}
