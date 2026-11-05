import {AuthLoginCommand} from './auth/AuthLoginCommand';
import {AuthLogoutCommand} from './auth/AuthLogoutCommand';
import {AuthProfilesCommand} from './auth/AuthProfilesCommand';
import {AuthStatusCommand} from './auth/AuthStatusCommand';
import {BackupsCreateCommand} from './backups/BackupsCreateCommand';
import {BackupsDeleteCommand} from './backups/BackupsDeleteCommand';
import {BackupsListCommand} from './backups/BackupsListCommand';
import {BackupsRestoreCommand} from './backups/BackupsRestoreCommand';
import {CacheCdnClearCommand} from './cache/CacheCdnClearCommand';
import {CacheCdnImageOptimizationCommand} from './cache/CacheCdnImageOptimizationCommand';
import {CacheClearCommand} from './cache/CacheClearCommand';
import {CacheEdgeClearCommand} from './cache/CacheEdgeClearCommand';
import {CacheEdgeDisableCommand} from './cache/CacheEdgeDisableCommand';
import {CacheEdgeEnableCommand} from './cache/CacheEdgeEnableCommand';
import type {CommandClass, GroupDef} from './BaseCommand';
import {CommandsCommand} from './CommandsCommand';
import {DomainsAddCommand} from './domains/DomainsAddCommand';
import {DomainsListCommand} from './domains/DomainsListCommand';
import {DomainsPrimaryCommand} from './domains/DomainsPrimaryCommand';
import {DomainsRemoveCommand} from './domains/DomainsRemoveCommand';
import {DomainsVerificationCommand} from './domains/DomainsVerificationCommand';
import {EnvListCommand} from './env/EnvListCommand';
import {EnvPushCommand} from './env/EnvPushCommand';
import {LogsCommand} from './logs/LogsCommand';
import {OperationsGetCommand} from './operations/OperationsGetCommand';
import {OperationsWaitCommand} from './operations/OperationsWaitCommand';
import {PhpRestartCommand} from './php/PhpRestartCommand';
import {PhpVersionCommand} from './php/PhpVersionCommand';
import {PluginsListCommand} from './plugins/PluginsListCommand';
import {PluginsUpdateCommand} from './plugins/PluginsUpdateCommand';
import {ThemesListCommand} from './plugins/ThemesListCommand';
import {ThemesUpdateCommand} from './plugins/ThemesUpdateCommand';
import {SitesGetCommand} from './sites/SitesGetCommand';
import {SitesListCommand} from './sites/SitesListCommand';

export const COMMANDS: CommandClass[] = [
    AuthLoginCommand,
    AuthStatusCommand,
    AuthLogoutCommand,
    AuthProfilesCommand,
    CommandsCommand,
    OperationsGetCommand,
    OperationsWaitCommand,
    LogsCommand,
    SitesListCommand,
    SitesGetCommand,
    EnvListCommand,
    EnvPushCommand,
    CacheClearCommand,
    CacheEdgeClearCommand,
    CacheEdgeEnableCommand,
    CacheEdgeDisableCommand,
    CacheCdnClearCommand,
    CacheCdnImageOptimizationCommand,
    PhpRestartCommand,
    PhpVersionCommand,
    PluginsListCommand,
    PluginsUpdateCommand,
    ThemesListCommand,
    ThemesUpdateCommand,
    BackupsListCommand,
    BackupsCreateCommand,
    BackupsRestoreCommand,
    BackupsDeleteCommand,
    DomainsListCommand,
    DomainsAddCommand,
    DomainsRemoveCommand,
    DomainsPrimaryCommand,
    DomainsVerificationCommand,
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
    {path: 'plugins', description: 'List and update WordPress plugins'},
    {path: 'themes', description: 'List and update WordPress themes'},
    {path: 'backups', description: 'List, create, restore and delete backups'},
    {path: 'domains', description: 'Manage the domains of an environment'},
];
