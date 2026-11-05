import type {Command} from 'commander';
import {validate} from '@/client/endpoints/account';
import {loadConfig, saveConfig, selectedProfileName} from '../config';
import {CliError} from '../errors';
import {meta} from '../program';
import type {Runtime} from '../runtime';

interface ValidateResponse {
    name: string;
    company: string;
    status: string;
    expires_at: string | null;
}

export function registerAuth(program: Command, rt: Runtime): void {
    const auth = program
        .command('auth')
        .description('Manage stored credentials');

    meta(
        auth
            .command('login')
            .description('Validate an API key and store it in a profile')
            .option(
                '--api-key <key>',
                'API key (required when not interactive); "-" reads it from stdin. A literal key ends up in your shell history: prefer "--api-key -" or KINSTA_API_KEY',
            )
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl auth login\n  $ kinstactl auth login --profile work --api-key -  < key.txt\n  $ kinstactl auth login --profile work --api-key <key>',
            )
            .action(async (opts: {apiKey?: string}) => {
                let apiKey = opts.apiKey;
                if (apiKey === '-') {
                    if (!rt.io.stdin)
                        throw new CliError(
                            'USAGE',
                            'Reading the API key from stdin is not available here',
                        );
                    apiKey = (await rt.io.stdin()).trim();
                    if (!apiKey)
                        throw new CliError(
                            'USAGE',
                            'stdin is empty; expected the API key',
                        );
                }
                if (!apiKey) {
                    if (!rt.interactive) {
                        throw new CliError(
                            'USAGE',
                            'No API key given and prompting is disabled',
                            ['Pass --api-key <key> or --api-key - (stdin)'],
                        );
                    }
                    apiKey = await rt.prompts.text('Kinsta API key', {
                        secret: true,
                    });
                }

                // /validate does not depend on the company, which is what this call discovers.
                const res = await rt
                    .clientFor(apiKey, '')
                    .send<ValidateResponse>(validate());
                if (!res.company)
                    throw new CliError(
                        'API_ERROR',
                        'Kinsta /validate returned no company ID',
                    );

                const cfg = loadConfig(rt.io.env);
                const name = selectedProfileName(
                    rt.io.env,
                    {profile: rt.profile},
                    cfg,
                );
                cfg.profiles[name] = {
                    apiKey,
                    companyId: res.company,
                    keyName: res.name,
                };
                cfg.defaultProfile ??= name;
                saveConfig(rt.io.env, cfg);
                rt.output.success(
                    `Stored profile "${name}" (company ${res.company}, key ${res.name})`,
                    {
                        profile: name,
                        companyId: res.company,
                        keyName: res.name,
                    },
                );
            }),
        {endpoints: ['GET /validate']},
    );

    meta(
        auth
            .command('status')
            .description(
                'Show the active credentials and validate them against Kinsta',
            )
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl auth status\n  $ kinstactl auth status --json',
            )
            .action(async () => {
                const creds = rt.credentials();
                const res = await rt
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
                rt.output.data(status, () =>
                    [
                        `Source:     ${status.source}`,
                        `Profile:    ${status.profile ?? '-'}`,
                        `Company ID: ${status.companyId}`,
                        `Key name:   ${status.keyName}`,
                        `Status:     ${status.status}`,
                        `Expires:    ${status.expiresAt ?? 'never'}`,
                    ].join('\n'),
                );
            }),
        {endpoints: ['GET /validate']},
    );

    meta(
        auth
            .command('logout')
            .description('Remove a stored profile')
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl auth logout\n  $ kinstactl auth logout --profile work',
            )
            .action(() => {
                const cfg = loadConfig(rt.io.env);
                const name = selectedProfileName(
                    rt.io.env,
                    {profile: rt.profile},
                    cfg,
                );
                if (!cfg.profiles[name]) {
                    throw new CliError('USAGE', `Profile "${name}" not found`, [
                        `Existing profiles: ${Object.keys(cfg.profiles).join(', ') || 'none'}`,
                    ]);
                }
                delete cfg.profiles[name];
                if (cfg.defaultProfile === name) delete cfg.defaultProfile;
                saveConfig(rt.io.env, cfg);
                rt.output.success(`Removed profile "${name}"`, {removed: name});
            }),
        {endpoints: []},
    );

    meta(
        auth
            .command('profiles')
            .description('List stored profiles')
            .addHelpText(
                'after',
                '\nExamples:\n  $ kinstactl auth profiles\n  $ kinstactl auth profiles --json',
            )
            .action(() => {
                const cfg = loadConfig(rt.io.env);
                const rows = Object.entries(cfg.profiles).map(([name, p]) => ({
                    name,
                    companyId: p.companyId,
                    keyName: p.keyName ?? null,
                    default: name === (cfg.defaultProfile ?? 'default'),
                }));
                rt.output.table(rows, [
                    {header: 'PROFILE', value: (r) => r.name},
                    {header: 'COMPANY', value: (r) => r.companyId},
                    {header: 'KEY', value: (r) => r.keyName ?? '-'},
                    {header: 'DEFAULT', value: (r) => (r.default ? '*' : '')},
                ]);
            }),
        {endpoints: []},
    );
}
