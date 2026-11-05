import {injectable} from 'tsyringe';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

/** Used by the completion scripts: never prompts, reads the site cache. */
@injectable()
export class CompletionEnvsCommand implements BaseCommand {
    readonly name = 'completion envs';
    readonly description =
        'Print the environment names of a site for shell completion';
    readonly arguments: ArgumentDef[] = [siteArgument('site name or ID')];
    readonly options: OptionDef[] = [];
    readonly examples = ['kinstactl completion envs klant-x'];
    readonly endpoints: EndpointKey[] = ['GET /sites'];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs): Promise<void> {
        // Without this guard an interactive run would open the site picker.
        if (args.site === undefined)
            throw new CliError('USAGE', 'Missing <site>');
        const site = await this.resolver.resolveSite(args.site, {
            fresh: false,
        });
        const names = site.environments.map((e) => e.name);
        this.output.data(names, () => names.join('\n'));
    }
}
