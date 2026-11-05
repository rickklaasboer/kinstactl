import {inject, injectable} from 'tsyringe';
import {validate} from '@/client/endpoints/account';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {IO, type Io} from '../../io';
import {Output} from '../../output';
import {PROMPTS, type Prompts} from '../../prompts';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import {RunContext} from '../../services/RunContext';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

interface ValidateResponse {
    name: string;
    company: string;
    status: string;
    expires_at: string | null;
}

type Options = {apiKey?: string};

@injectable()
export class AuthLoginCommand implements BaseCommand<Options> {
    readonly name = 'auth login';
    readonly description = 'Validate an API key and store it in a profile';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [
        {
            flags: '--api-key <key>',
            description:
                'API key (required when not interactive); "-" reads it from stdin. A literal key ends up in your shell history: prefer "--api-key -" or KINSTA_API_KEY',
        },
    ];
    readonly examples = [
        'kinstactl auth login',
        'kinstactl auth login --profile work --api-key -  < key.txt',
        'kinstactl auth login --profile work --api-key <key>',
    ];
    readonly endpoints: EndpointKey[] = ['GET /validate'];

    constructor(
        private readonly ctx: RunContext,
        private readonly config: ConfigService,
        private readonly clients: ClientProvider,
        private readonly output: Output,
        @inject(PROMPTS) private readonly prompts: Prompts,
        @inject(IO) private readonly io: Io,
    ) {}

    async execute(_args: CommandArgs, options: Options): Promise<void> {
        let apiKey = options.apiKey;
        if (apiKey === '-') {
            if (!this.io.stdin)
                throw new CliError(
                    'USAGE',
                    'Reading the API key from stdin is not available here',
                );
            apiKey = (await this.io.stdin()).trim();
            if (!apiKey)
                throw new CliError(
                    'USAGE',
                    'stdin is empty; expected the API key',
                );
        }
        if (!apiKey) {
            if (!this.ctx.interactive) {
                throw new CliError(
                    'USAGE',
                    'No API key given and prompting is disabled',
                    ['Pass --api-key <key> or --api-key - (stdin)'],
                );
            }
            apiKey = await this.prompts.text('Kinsta API key', {
                secret: true,
            });
        }

        // /validate does not depend on the company, which is what this call discovers.
        const res = await this.clients
            .clientFor(apiKey, '')
            .send<ValidateResponse>(validate());
        if (!res.company)
            throw new CliError(
                'API_ERROR',
                'Kinsta /validate returned no company ID',
            );

        const cfg = this.config.load();
        const name = this.config.selectedProfileName(cfg);
        cfg.profiles[name] = {
            apiKey,
            companyId: res.company,
            keyName: res.name,
        };
        cfg.defaultProfile ??= name;
        this.config.save(cfg);
        this.output.success(
            `Stored profile "${name}" (company ${res.company}, key ${res.name})`,
            {
                profile: name,
                companyId: res.company,
                keyName: res.name,
            },
        );
    }
}
