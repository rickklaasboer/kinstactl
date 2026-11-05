import {injectable} from 'tsyringe';
import {searchAndReplace} from '@/client/endpoints/tools';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    Destructive,
    OptionDef,
} from '../BaseCommand';

type Options = {
    env?: string;
    apply?: boolean;
    clearCache?: boolean;
} & ActionFlags;

@injectable()
export class SearchReplaceCommand implements BaseCommand<Options> {
    readonly name = 'search-replace';
    readonly description =
        'Search and replace in the database (dry run unless --apply)';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {name: 'search', required: true, description: 'text to search for'},
        {name: 'replace', required: true, description: 'replacement text'},
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--apply',
            description: 'perform the replacement instead of reporting matches',
        },
        {
            flags: '--clear-cache',
            description: 'clear the cache after the replacement',
        },
        ...actionOptions({destructive: 'confirm'}),
    ];
    readonly examples = [
        'kinstactl search-replace klant-x http://old.example https://new.example --env live',
        'kinstactl search-replace klant-x http://old.example https://new.example --env live --apply --clear-cache --yes',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/tools/search-and-replace',
    ];
    readonly destructive: Destructive = 'confirm';

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const search = args.search!;
        const replace = args.replace!;
        const apply = options.apply === true;
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: apply},
        );
        const result = await this.operations.run({
            title: `Search and replace${apply ? '' : ' (dry run)'}`,
            spec: searchAndReplace(target.env.id, {
                search,
                replace,
                apply,
                clearCache: options.clearCache === true,
            }),
            target,
            flags: options,
            confirm: apply
                ? {
                      action: `Replace "${search}" with "${replace}" in the database`,
                      level: 'confirm',
                  }
                : undefined,
        });
        if (result === undefined) return;
        const {data} = result;
        this.output.data(result, () =>
            typeof data === 'string'
                ? data
                : data === undefined || data === null
                  ? (result.message ?? '')
                  : JSON.stringify(data, null, 2),
        );
    }
}
