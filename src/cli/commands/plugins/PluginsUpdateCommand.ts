import {injectable} from 'tsyringe';
import {PLUGINS} from './WpItemKind';
import {WpItemUpdateCommand} from './WpItemUpdateCommand';

@injectable()
export class PluginsUpdateCommand extends WpItemUpdateCommand {
    protected readonly kind = PLUGINS;
}
