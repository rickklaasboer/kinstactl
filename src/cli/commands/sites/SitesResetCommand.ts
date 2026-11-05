import {injectable} from 'tsyringe';
import {resetSite} from '@/client/endpoints/sites';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {redactKeys, SecretInput} from '../../services/SecretInput';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type Destructive,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type Options = {adminPassword?: string} & ActionFlags;

@injectable()
export class SitesResetCommand implements BaseCommand<Options> {
    readonly name = 'sites reset';
    readonly description =
        'Reset a site to a fresh WordPress install (all environments)';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {
            flags: '--admin-password <password>',
            description:
                '"-" reads it from stdin; omitted on a TTY prompts for it',
        },
        ...actionOptions({destructive: 'irreversible'}),
    ];
    readonly examples = [
        'kinstactl sites reset my-site --admin-password - --confirm my-site',
        'kinstactl sites reset my-site --admin-password x --dry-run',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/{site_id}/reset-site',
    ];
    readonly destructive: Destructive = 'irreversible';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly secrets: SecretInput,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const site = await this.resolver.resolveSite(args.site, {fresh: true});
        const password = await this.secrets.read(options.adminPassword, {
            flag: '--admin-password',
            label: 'admin password',
        });
        if (password === '')
            throw new CliError('USAGE', '--admin-password must not be empty');
        await this.operations.run({
            title: `Reset site ${site.name}`,
            spec: resetSite(site.id, password),
            target: {site},
            flags: options,
            confirm: {
                action: 'Reset site (all environments are wiped)',
                level: 'irreversible',
            },
            redact: redactKeys('admin_password'),
        });
    }
}
