import {inject, Lifecycle, scoped} from 'tsyringe';
import {listCompanyUsers} from '@/client/endpoints/account';
import {listBackups} from '@/client/endpoints/backups';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../../errors';
import {PROMPTS, type Prompts} from '../../prompts';
import {ClientProvider} from '../../services/ClientProvider';
import {ConfigService} from '../../services/ConfigService';
import {RunContext} from '../../services/RunContext';
import type {EnvRef, SiteRef} from '../../services/SiteCache';

type Schemas = components['schemas'];
export type Backup = Schemas['Backup'];
type CompanyUser =
    Schemas['CompanyUsersResponseSchema']['company']['users'][number]['user'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local time, e.g. 2026-11-05 14:03. */
export function formatTime(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseBackupId(v: string): number {
    if (!/^\d+$/.test(v))
        throw new CliError('USAGE', `backup id must be a number, got "${v}"`);
    return Number(v);
}

/** Reads backups and the company users a restore can notify. */
@scoped(Lifecycle.ContainerScoped)
export class BackupService {
    constructor(
        private readonly clients: ClientProvider,
        private readonly config: ConfigService,
        private readonly ctx: RunContext,
        @inject(PROMPTS) private readonly prompts: Prompts,
    ) {}

    async fetchBackups(envId: string): Promise<Backup[]> {
        const res = await this.clients
            .client()
            .send<Schemas['GetBackupsResponseSchema']>(listBackups(envId));
        return res.environment.backups;
    }

    async findBackup(
        target: {site: SiteRef; env: EnvRef},
        id: number,
    ): Promise<Backup> {
        const backup = (await this.fetchBackups(target.env.id)).find(
            (b) => b.id === id,
        );
        if (!backup)
            throw new CliError(
                'USAGE',
                `backup ${id} not found on ${target.site.name} (${target.env.name})`,
            );
        return backup;
    }

    /** A read; it must not prompt when non-interactive. */
    async resolveNotifiedUser(email: string | undefined): Promise<string> {
        const res = await this.clients
            .client()
            .send<Schemas['CompanyUsersResponseSchema']>(
                listCompanyUsers(this.config.credentials().companyId),
            );
        const users: CompanyUser[] = res.company.users.map((u) => u.user);

        if (email !== undefined) {
            const match = users.find(
                (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
            );
            if (match) return match.id;
            throw new CliError(
                'USAGE',
                `no company user with email ${email}`,
                users.map((u) => u.email),
            );
        }
        if (!this.ctx.interactive)
            throw new CliError(
                'USAGE',
                'restore needs a user to notify when it finishes',
                ['Pass --notify <email>'],
            );
        return this.prompts.select(
            'Notify which user when the restore finishes?',
            users.map((u) => ({
                value: u.id,
                label: u.email,
                hint: u.full_name,
            })),
        );
    }
}
