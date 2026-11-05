import {injectable} from 'tsyringe';
import {generateSshPassword} from '@/client/endpoints/ssh';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type Options = {env?: string} & ActionFlags;

@injectable()
export class SshPasswordGenerateCommand implements BaseCommand<Options> {
    readonly name = 'ssh password generate';
    readonly description = 'Generate a new SSH/SFTP password';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        ...actionOptions({wait: false}),
    ];
    readonly examples = ['kinstactl ssh password generate klant-x --env live'];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/ssh/generate-password',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        const res = await this.operations.send({
            title: 'Generate SFTP password',
            spec: generateSshPassword(target.env.id),
            target,
            flags: options,
        });
        if (res === undefined) return;
        this.output.success(
            `New SFTP password generated; show it with: kinstactl ssh password get ${target.site.name} --env ${target.env.name}`,
            {
                site: target.site.name,
                environment: target.env.name,
                generated: true,
            },
        );
    }
}
