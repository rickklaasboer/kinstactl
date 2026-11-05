import type {Command} from 'commander';
import {listCompanyUsers} from '@/client/endpoints/account';
import {
    createManualBackup,
    deleteBackup,
    listBackups,
    restoreBackup,
} from '@/client/endpoints/backups';
import type {components} from '@/client/generated/openapi';
import {CliError} from '../errors';
import {addActionFlags, type ActionFlags, runOperation} from '../progress';
import {meta} from '../program';
import {resolveTarget} from '../resolve';
import type {Runtime} from '../runtime';

type Schemas = components['schemas'];
type Backup = Schemas['Backup'];
type CompanyUser =
    Schemas['CompanyUsersResponseSchema']['company']['users'][number]['user'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local time, e.g. 2026-11-05 14:03. */
function formatTime(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchBackups(rt: Runtime, envId: string): Promise<Backup[]> {
    const res = await rt
        .client()
        .send<Schemas['GetBackupsResponseSchema']>(listBackups(envId));
    return res.environment.backups;
}

function parseBackupId(v: string): number {
    if (!/^\d+$/.test(v))
        throw new CliError('USAGE', `backup id must be a number, got "${v}"`);
    return Number(v);
}

async function findBackup(
    rt: Runtime,
    target: Awaited<ReturnType<typeof resolveTarget>>,
    id: number,
): Promise<Backup> {
    const backup = (await fetchBackups(rt, target.env.id)).find(
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
async function resolveNotifiedUser(
    rt: Runtime,
    email: string | undefined,
): Promise<string> {
    const res = await rt
        .client()
        .send<Schemas['CompanyUsersResponseSchema']>(
            listCompanyUsers(rt.credentials().companyId),
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
    if (!rt.interactive)
        throw new CliError(
            'USAGE',
            'restore needs a user to notify when it finishes',
            ['Pass --notify <email>'],
        );
    return rt.prompts.select(
        'Notify which user when the restore finishes?',
        users.map((u) => ({value: u.id, label: u.email, hint: u.full_name})),
    );
}

export function registerBackups(program: Command, rt: Runtime): void {
    const backups = program
        .command('backups')
        .description('List, create, restore and delete backups');

    meta(
        backups
            .command('list')
            .description('List the backups of an environment, newest first')
            .argument('<site>', 'site name or ID')
            .option('--env <name>', 'environment (default: the only one)')
            .option(
                '--type <type>',
                'only this backup type, e.g. manual, scheduled or system',
            )
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl backups list klant-x\n  $ kinstactl backups list klant-x --env staging --type manual',
            )
            .action(
                async (site: string, opts: {env?: string; type?: string}) => {
                    const target = await resolveTarget(rt, site, opts.env, {
                        write: false,
                    });
                    const rows = (await fetchBackups(rt, target.env.id))
                        .filter(
                            (b) =>
                                opts.type === undefined || b.type === opts.type,
                        )
                        .sort((a, b) => b.created_at - a.created_at);
                    rt.output.table(rows, [
                        {header: 'ID', value: (b) => String(b.id)},
                        {header: 'TYPE', value: (b) => b.type},
                        {header: 'NOTE', value: (b) => b.note ?? ''},
                        {
                            header: 'CREATED',
                            value: (b) => formatTime(b.created_at),
                        },
                    ]);
                },
            ),
        {endpoints: ['GET /sites/environments/{env_id}/backups']},
    );

    meta(
        addActionFlags(
            backups
                .command('create')
                .description('Create a manual backup')
                .argument('<site>', 'site name or ID')
                .option('--env <name>', 'environment (default: the only one)')
                .option('--tag <text>', 'label for the backup')
                .addHelpText(
                    'after',
                    '\nExamples:\n  $ kinstactl backups create klant-x\n  $ kinstactl backups create klant-x --env live --tag "before plugin update"',
                ),
            {},
        ).action(
            async (
                site: string,
                opts: {env?: string; tag?: string} & ActionFlags,
            ) => {
                const target = await resolveTarget(rt, site, opts.env, {
                    write: true,
                });
                await runOperation(rt, {
                    title: `Create backup of ${target.site.name} (${target.env.name})`,
                    spec: createManualBackup(target.env.id, opts.tag),
                    target,
                    flags: opts,
                });
            },
        ),
        {endpoints: ['POST /sites/environments/{env_id}/manual-backups']},
    );

    meta(
        addActionFlags(
            backups
                .command('restore')
                .description('Restore a backup, replacing the environment')
                .argument('<site>', 'site name or ID')
                .argument('<backup-id>', 'backup ID, see: backups list')
                .option(
                    '--env <name>',
                    'environment to restore to (default: the only one)',
                )
                .option(
                    '--notify <email>',
                    'company user to notify when the restore finishes',
                )
                .addHelpText(
                    'after',
                    '\nExamples:\n  $ kinstactl backups restore klant-x 123456789 --notify rick@example.com\n  $ kinstactl backups restore klant-x 123456789 --env staging --notify rick@example.com --yes',
                ),
            {destructive: 'confirm'},
        ).action(
            async (
                site: string,
                backupId: string,
                opts: {env?: string; notify?: string} & ActionFlags,
            ) => {
                const id = parseBackupId(backupId);
                const target = await resolveTarget(rt, site, opts.env, {
                    write: true,
                });
                const backup = await findBackup(rt, target, id);
                const userId = await resolveNotifiedUser(rt, opts.notify);
                await runOperation(rt, {
                    title: `Restore backup ${id} to ${target.site.name} (${target.env.name})`,
                    spec: restoreBackup(target.env.id, id, userId),
                    target,
                    flags: opts,
                    confirm: {
                        action: `Restore backup ${id} (${formatTime(backup.created_at)})`,
                        level: 'confirm',
                    },
                });
            },
        ),
        {
            destructive: 'confirm',
            endpoints: [
                'GET /sites/environments/{env_id}/backups',
                'GET /company/{id}/users',
                'POST /sites/environments/{target_env_id}/backups/restore',
            ],
        },
    );

    meta(
        addActionFlags(
            backups
                .command('delete')
                .description('Delete a backup')
                .argument('<site>', 'site name or ID')
                .argument('<backup-id>', 'backup ID, see: backups list')
                .option('--env <name>', 'environment (default: the only one)')
                .addHelpText(
                    'after',
                    '\nExamples:\n  $ kinstactl backups delete klant-x 123456789\n  $ kinstactl backups delete klant-x 123456789 --env staging --yes',
                ),
            {destructive: 'confirm'},
        ).action(
            async (
                site: string,
                backupId: string,
                opts: {env?: string} & ActionFlags,
            ) => {
                const id = parseBackupId(backupId);
                const target = await resolveTarget(rt, site, opts.env, {
                    write: true,
                });
                const backup = await findBackup(rt, target, id);
                await runOperation(rt, {
                    title: `Delete backup ${id} from ${target.site.name} (${target.env.name})`,
                    spec: deleteBackup(id),
                    target,
                    flags: opts,
                    confirm: {
                        action: `Delete backup ${id} (${formatTime(backup.created_at)})`,
                        level: 'confirm',
                    },
                });
            },
        ),
        {
            destructive: 'confirm',
            endpoints: [
                'GET /sites/environments/{env_id}/backups',
                'DELETE /sites/environments/backups/{backup_id}',
            ],
        },
    );
}
