import {injectable} from 'tsyringe';
import {getVerificationRecords} from '@/client/endpoints/domains';
import type {components} from '@/client/generated/openapi';
import type {EndpointKey} from '@/client/request';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {SiteResolver} from '../../services/SiteResolver';
import {renderTable} from '../../table';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';
import {DomainService} from './DomainService';

type Response = components['schemas']['GetVerificationRecordsResponseSchema'];
type DnsRecord = {type: string; name: string; value: string};

type Options = {env?: string};

@injectable()
export class DomainsVerificationCommand implements BaseCommand<Options> {
    readonly name = 'domains verification';
    readonly description =
        'Show the DNS records that verify and point a domain';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'site',
            required: true,
            description: 'site name, display name or ID',
        },
        {
            name: 'domain',
            required: true,
            description: 'domain name or ID, see: domains list',
        },
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <environment>', description: 'environment name or ID'},
    ];
    readonly examples = [
        'kinstactl domains verification my-site example.com',
        'kinstactl domains verification my-site example.com --json',
    ];
    readonly endpoints: EndpointKey[] = [
        'GET /sites',
        'GET /sites/environments/{env_id}/domains',
        'GET /sites/environments/domains/{site_domain_id}/verification-records',
    ];

    constructor(
        private readonly resolver: SiteResolver,
        private readonly domains: DomainService,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs, options: Options): Promise<void> {
        const target = await this.resolver.resolveTarget(
            args.site,
            options.env,
            {write: false},
        );
        const domain = await this.domains.find(target, args.domain as string);
        const res = await this.clients
            .client()
            .send<Response>(getVerificationRecords(domain.id));
        const {verification_records, pointing_records} = res.site_domain;

        const section = (title: string, rows: DnsRecord[]) =>
            `${title}\n${renderTable(
                ['TYPE', 'NAME', 'VALUE'],
                rows.map((r) => [r.type, r.name, r.value]),
            )}`;
        this.output.data(
            res,
            () =>
                `${section('Verification records', verification_records)}\n\n${section('Pointing records', pointing_records)}`,
        );
    }
}
