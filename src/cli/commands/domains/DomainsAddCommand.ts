import {readFileSync} from 'node:fs';
import {InvalidArgumentError} from 'commander';
import {injectable} from 'tsyringe';
import {addSiteDomain} from '@/client/endpoints/domains';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {
    type ActionFlags,
    actionOptions,
    OperationRunner,
} from '../../services/OperationRunner';
import {redactKeys} from '../../services/SecretInput';
import {SiteResolver} from '../../services/SiteResolver';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

type SetupType = 'quick' | 'avoid_downtime';

type Options = {
    env?: string;
    withWww?: boolean;
    wildcard?: boolean;
    setupType?: SetupType;
    sslKey?: string;
    sslCert?: string;
} & ActionFlags;

function parseSetupType(v: string): SetupType {
    if (v !== 'quick' && v !== 'avoid_downtime')
        throw new InvalidArgumentError('must be quick or avoid_downtime');
    return v;
}

function readPemFile(flag: string, file: string): string {
    let content: string;
    try {
        content = readFileSync(file, 'utf8');
    } catch (e) {
        throw new CliError(
            'USAGE',
            `cannot read ${flag} file ${file}: ${e instanceof Error ? e.message : String(e)}`,
        );
    }
    if (content.trim() === '')
        throw new CliError('USAGE', `${flag} file ${file} is empty`);
    return content;
}

@injectable()
export class DomainsAddCommand implements BaseCommand<Options> {
    readonly name = 'domains add';
    readonly description = 'Add a domain to an environment';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {name: 'domain', required: true, description: 'domain name to add'},
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
        {
            flags: '--with-www',
            description: 'also add the www subdomain',
        },
        {
            flags: '--wildcard',
            description: 'also cover subdomains (clears is_wildcardless)',
        },
        {
            flags: '--setup-type <type>',
            description: 'quick or avoid_downtime',
            parse: parseSetupType,
        },
        {
            flags: '--ssl-key <file>',
            description: 'private key file of a custom SSL certificate',
        },
        {
            flags: '--ssl-cert <file>',
            description: 'certificate file of a custom SSL certificate',
        },
        ...actionOptions({}),
    ];
    readonly examples = [
        'kinstactl domains add klant-x example.com --env live',
        'kinstactl domains add klant-x example.com --with-www --ssl-key key.pem --ssl-cert cert.pem',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'POST /sites/environments/{env_id}/domains',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly operations: OperationRunner,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        if ((options.sslKey === undefined) !== (options.sslCert === undefined))
            throw new CliError(
                'USAGE',
                '--ssl-key and --ssl-cert must be given together',
            );
        const domain = args.domain as string;
        const customSslKey =
            options.sslKey && readPemFile('--ssl-key', options.sslKey);
        const customSslCert =
            options.sslCert && readPemFile('--ssl-cert', options.sslCert);

        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: true},
        );
        await this.operations.run({
            title: `Add domain ${domain} to ${target.site.name} (${target.env.name})`,
            spec: addSiteDomain(target.env.id, {
                domainName: domain,
                wildcard: options.wildcard,
                withWww: options.withWww,
                setupType: options.setupType,
                customSslKey,
                customSslCert,
            }),
            target,
            flags: options,
            redact: redactKeys('custom_ssl_key'),
        });
    }
}
