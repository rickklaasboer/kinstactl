import {injectable} from 'tsyringe';
import {THEMES} from './WpItemKind';
import {WpItemListCommand} from './WpItemListCommand';

@injectable()
export class ThemesListCommand extends WpItemListCommand {
    protected readonly kind = THEMES;
}
