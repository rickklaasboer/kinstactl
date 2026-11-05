import type {Command} from 'commander';
import type {Runtime} from '../runtime';
import {AuthLoginCommand} from './auth/AuthLoginCommand';
import {AuthLogoutCommand} from './auth/AuthLogoutCommand';
import {AuthProfilesCommand} from './auth/AuthProfilesCommand';
import {AuthStatusCommand} from './auth/AuthStatusCommand';
import {registerBackups} from './backups';
import {registerCache} from './cache';
import {registerCommands} from './commands';
import type {CommandClass, GroupDef} from './BaseCommand';
import {EnvListCommand} from './env/EnvListCommand';
import {EnvPushCommand} from './env/EnvPushCommand';
import {LogsCommand} from './logs/LogsCommand';
import {OperationsGetCommand} from './operations/OperationsGetCommand';
import {OperationsWaitCommand} from './operations/OperationsWaitCommand';
import {registerPhp} from './php';
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
    {legacy: registerCache},
    {legacy: registerPhp},
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
];
