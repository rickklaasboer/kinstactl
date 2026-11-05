import {injectable} from 'tsyringe';
import {validate} from '@/client/endpoints/account';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import type {ArgumentDef, BaseCommand, OptionDef} from '../BaseCommand';

interface ValidateResponse {
    name: string;
    company: string;
    status: string;
    expires_at: string | null;
}

@injectable()
export class AuthStatusCommand implements BaseCommand {
    readonly name = 'auth status';
    readonly description =
        'Show the active credentials and validate them against Kinsta';
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples = [
        'kinstactl auth status',
        'kinstactl auth status --json',
    ];
    readonly endpoints = ['GET /validate' as const];

    constructor(
        private readonly config: ConfigService,
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(): Promise<void> {
        const creds = this.config.credentials();
        const res = await this.clients
            .client()
            .send<ValidateResponse>(validate());
        const status = {
            source: creds.source,
            profile: creds.profile ?? null,
            companyId: creds.companyId,
            keyName: res.name,
            status: res.status,
            expiresAt: res.expires_at,
        };
        this.output.data(status, () =>
            [
                `Source:     ${status.source}`,
                `Profile:    ${status.profile ?? '-'}`,
                `Company ID: ${status.companyId}`,
                `Key name:   ${status.keyName}`,
                `Status:     ${status.status}`,
                `Expires:    ${status.expiresAt ?? 'never'}`,
            ].join('\n'),
        );
    }
}
