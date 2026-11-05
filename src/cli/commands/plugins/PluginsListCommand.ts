import {injectable} from 'tsyringe';
import {PLUGINS} from './WpItemKind';
import {WpItemListCommand} from './WpItemListCommand';

@injectable()
export class PluginsListCommand extends WpItemListCommand {
    protected readonly kind = PLUGINS;
}
