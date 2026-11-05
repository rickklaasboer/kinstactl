import {injectable} from 'tsyringe';
import {THEMES} from './WpItemKind';
import {WpItemUpdateCommand} from './WpItemUpdateCommand';

@injectable()
export class ThemesUpdateCommand extends WpItemUpdateCommand {
    protected readonly kind = THEMES;
}
