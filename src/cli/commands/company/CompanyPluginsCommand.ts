import {injectable} from 'tsyringe';
import {CompanyWpItemsCommand} from './CompanyWpItemsCommand';

@injectable()
export class CompanyPluginsCommand extends CompanyWpItemsCommand {
    protected readonly kind = 'plugins';
}
