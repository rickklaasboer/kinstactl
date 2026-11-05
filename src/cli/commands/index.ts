import type {Command} from 'commander';
import type {Runtime} from '../runtime';
import {AuthLoginCommand} from './auth/AuthLoginCommand';
import {AuthLogoutCommand} from './auth/AuthLogoutCommand';
import {AuthProfilesCommand} from './auth/AuthProfilesCommand';
import {AuthStatusCommand} from './auth/AuthStatusCommand';
import {registerBackups} from './backups';
import {CacheCdnClearCommand} from './cache/CacheCdnClearCommand';
import {CacheClearCommand} from './cache/CacheClearCommand';
import {CacheEdgeClearCommand} from './cache/CacheEdgeClearCommand';
import {registerCommands} from './commands';
import type {CommandClass, GroupDef} from './BaseCommand';
import {EnvListCommand} from './env/EnvListCommand';
import {EnvPushCommand} from './env/EnvPushCommand';
import {LogsCommand} from './logs/LogsCommand';
import {OperationsGetCommand} from './operations/OperationsGetCommand';
import {OperationsWaitCommand} from './operations/OperationsWaitCommand';
import {PhpRestartCommand} from './php/PhpRestartCommand';
import {PhpVersionCommand} from './php/PhpVersionCommand';
import {registerPlugins} from './plugins';
import {SitesGetCommand} from './sites/SitesGetCommand';
import {SitesListCommand} from './sites/SitesListCommand';

/** Transitional: a not yet migrated command module, removed once all are classes. */
export interface LegacyEntry {
    legacy: (program: Command, rt: Runtime) => void;
}

export const COMMANDS: (CommandClass | LegacyEntry)[] = [
    AuthLoginCommand,
    AuthStatusCommand,
    AuthLogoutCommand,
    AuthProfilesCommand,
    {legacy: registerCommands},
    OperationsGetCommand,
    OperationsWaitCommand,
    LogsCommand,
    SitesListCommand,
    SitesGetCommand,
    EnvListCommand,
    EnvPushCommand,
    CacheClearCommand,
    CacheEdgeClearCommand,
    CacheCdnClearCommand,
    PhpRestartCommand,
    PhpVersionCommand,
    {legacy: registerPlugins},
    {legacy: registerBackups},
];

export const GROUPS: GroupDef[] = [
    {path: 'auth', description: 'Manage stored credentials'},
    {
        path: 'operations',
        description: 'Inspect and follow long-running Kinsta operations',
    },
    {path: 'sites', description: 'List and inspect Kinsta sites'},
    {path: 'env', description: 'List and manage environments of a site'},
    {path: 'cache', description: 'Clear the caches of a site environment'},
    {path: 'cache edge', description: 'Edge cache'},
    {path: 'cache cdn', description: 'CDN cache'},
    {path: 'php', description: 'Manage the PHP engine of a site environment'},
];
