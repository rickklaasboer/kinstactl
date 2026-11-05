import {injectable} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {SiteCache} from '../../services/SiteCache';
import type {ArgumentDef, BaseCommand, OptionDef} from '../BaseCommand';

/** Used by the completion scripts: never prompts, reads the site cache. */
@injectable()
export class CompletionSitesCommand implements BaseCommand {
    readonly name = 'completion sites';
    readonly description = 'Print the site names for shell completion';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples = ['kinstactl completion sites'];
    readonly endpoints: EndpointKey[] = ['GET /sites'];

    constructor(
        private readonly cache: SiteCache,
        private readonly output: Output,
    ) {}

    async execute(): Promise<void> {
        const sites = await this.cache.load({fresh: false});
        const names = sites.map((s) => s.name);
        this.output.data(names, () => names.join('\n'));
    }
}
