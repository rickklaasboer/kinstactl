import type {Command} from 'commander';
import type {Runtime} from '../runtime';
import {registerAuth} from './auth';
import {registerBackups} from './backups';
import {registerCache} from './cache';
import {registerCommands} from './commands';
import {registerEnv} from './env';
import type {CommandClass, GroupDef} from './BaseCommand';
import {registerLogs} from './logs';
import {registerOperations} from './operations';
import {registerPhp} from './php';
import {registerPlugins} from './plugins';
import {registerSites} from './sites';

/** Transitional: a not yet migrated command module, removed once all are classes. */
export interface LegacyEntry {
    legacy: (program: Command, rt: Runtime) => void;
}

export const COMMANDS: (CommandClass | LegacyEntry)[] = [
    {legacy: registerAuth},
    {legacy: registerCommands},
    {legacy: registerOperations},
    {legacy: registerLogs},
    {legacy: registerSites},
    {legacy: registerEnv},
    {legacy: registerCache},
    {legacy: registerPhp},
    {legacy: registerPlugins},
    {legacy: registerBackups},
];

export const GROUPS: GroupDef[] = [];
