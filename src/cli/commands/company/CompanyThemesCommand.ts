import {injectable} from 'tsyringe';
import {CompanyWpItemsCommand} from './CompanyWpItemsCommand';

@injectable()
export class CompanyThemesCommand extends CompanyWpItemsCommand {
    protected readonly kind = 'themes';
}
