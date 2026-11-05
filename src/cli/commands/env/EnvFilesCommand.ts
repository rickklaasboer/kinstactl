import {injectable} from 'tsyringe';
import {listFiles} from '@/client/endpoints/environments';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteResolver} from '../../services/SiteResolver';
import {
    type ArgumentDef,
    type BaseCommand,
    type CommandArgs,
    type OptionDef,
    siteArgument,
} from '../BaseCommand';

type FileList =
    components['schemas']['GetEnvironmentFileListResponseSchema']['environment']['file_list'];

type Options = {env?: string};

interface FileNode {
    name: string;
    children?: FileNode[];
}

function lines(nodes: FileNode[], depth: number): string[] {
    return nodes.flatMap((n) => [
        `${'  '.repeat(depth)}${n.name}`,
        ...lines(n.children ?? [], depth + 1),
    ]);
}

@injectable()
export class EnvFilesCommand implements BaseCommand<Options> {
    readonly name = 'env files';
    readonly description = 'Show the file tree of an environment';
    readonly arguments: ArgumentDef[] = [siteArgument()];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl env files klant-x --env live',
        'kinstactl env files klant-x --env live --json',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/file-list',
    ];

    constructor(
        private readonly output: Output,
        private readonly resolver: SiteResolver,
        private readonly clients: ClientProvider,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const res = await this.clients
            .client()
            .send<
                components['schemas']['GetEnvironmentFileListResponseSchema']
            >(listFiles(target.env.id));
        const tree: FileList = res.environment.file_list;
        this.output.data(tree, () => lines(tree, 0).join('\n'));
    }
}
