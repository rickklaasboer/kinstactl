import type {Command} from 'commander';
import type {Runtime} from '../runtime';
import {registerAuth} from './auth';
import {registerBackups} from './backups';
import {registerCache} from './cache';
import {registerCommands} from './commands';
import type {CommandClass, GroupDef} from './BaseCommand';
import {EnvListCommand} from './env/EnvListCommand';
import {EnvPushCommand} from './env/EnvPushCommand';
import {registerLogs} from './logs';
import {registerOperations} from './operations';
import {registerPhp} from './php';
import {registerPlugins} from './plugins';
import {SitesGetCommand} from './sites/SitesGetCommand';
import {SitesListCommand} from './sites/SitesListCommand';

/** Transitional: a not yet migrated command module, removed once all are classes. */
export interface LegacyEntry {
    legacy: (program: Command, rt: Runtime) => void;
}

export const COMMANDS: (CommandClass | LegacyEntry)[] = [
    {legacy: registerAuth},
    {legacy: registerCommands},
    {legacy: registerOperations},
    {legacy: registerLogs},
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
    {path: 'sites', description: 'List and inspect Kinsta sites'},
    {path: 'env', description: 'List and manage environments of a site'},
];
