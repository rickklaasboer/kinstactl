import {AuthLoginCommand} from './auth/AuthLoginCommand';
import {AuthLogoutCommand} from './auth/AuthLogoutCommand';
import {AuthProfilesCommand} from './auth/AuthProfilesCommand';
import {AuthStatusCommand} from './auth/AuthStatusCommand';
import {BackupsCreateCommand} from './backups/BackupsCreateCommand';
import {BackupsDeleteCommand} from './backups/BackupsDeleteCommand';
import {BackupsDownloadableCreateCommand} from './backups/BackupsDownloadableCreateCommand';
import {BackupsDownloadableListCommand} from './backups/BackupsDownloadableListCommand';
import {BackupsDownloadableQuotaCommand} from './backups/BackupsDownloadableQuotaCommand';
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
import {DbLoginCommand} from './db/DbLoginCommand';
import {DnsRecordsAddCommand} from './dns/DnsRecordsAddCommand';
import {DnsRecordsDeleteCommand} from './dns/DnsRecordsDeleteCommand';
import {DnsRecordsListCommand} from './dns/DnsRecordsListCommand';
import {DnsRecordsUpdateCommand} from './dns/DnsRecordsUpdateCommand';
import {DnsZonesCommand} from './dns/DnsZonesCommand';
import {DomainsAddCommand} from './domains/DomainsAddCommand';
import {DomainsListCommand} from './domains/DomainsListCommand';
import {DomainsPrimaryCommand} from './domains/DomainsPrimaryCommand';
import {DomainsRemoveCommand} from './domains/DomainsRemoveCommand';
import {DomainsVerificationCommand} from './domains/DomainsVerificationCommand';
import {EnvCloneCommand} from './env/EnvCloneCommand';
import {EnvCreateCommand} from './env/EnvCreateCommand';
import {EnvDeleteCommand} from './env/EnvDeleteCommand';
import {EnvFilesCommand} from './env/EnvFilesCommand';
import {EnvListCommand} from './env/EnvListCommand';
import {EnvPhpAllocationCommand} from './env/EnvPhpAllocationCommand';
import {EnvPushCommand} from './env/EnvPushCommand';
import {EnvWebrootCommand} from './env/EnvWebrootCommand';
import {LogsCommand} from './logs/LogsCommand';
import {OperationsGetCommand} from './operations/OperationsGetCommand';
import {OperationsWaitCommand} from './operations/OperationsWaitCommand';
import {PhpRestartCommand} from './php/PhpRestartCommand';
import {PhpVersionCommand} from './php/PhpVersionCommand';
import {PluginsListCommand} from './plugins/PluginsListCommand';
import {PluginsUpdateCommand} from './plugins/PluginsUpdateCommand';
import {ThemesListCommand} from './plugins/ThemesListCommand';
import {ThemesUpdateCommand} from './plugins/ThemesUpdateCommand';
import {SearchReplaceCommand} from './search-replace/SearchReplaceCommand';
import {SitesCloneCommand} from './sites/SitesCloneCommand';
import {SitesCreateCommand} from './sites/SitesCreateCommand';
import {SitesDeleteCommand} from './sites/SitesDeleteCommand';
import {SitesGetCommand} from './sites/SitesGetCommand';
import {SitesListCommand} from './sites/SitesListCommand';
import {SitesPhpAllocationCommand} from './sites/SitesPhpAllocationCommand';
import {SitesResetCommand} from './sites/SitesResetCommand';
import {WpLoginCommand} from './wp/WpLoginCommand';
import {WpRunCommand} from './wp/WpRunCommand';
import {WpUserCreateCommand} from './wp/WpUserCreateCommand';
import {WpUserExistsCommand} from './wp/WpUserExistsCommand';

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
    SitesCreateCommand,
    SitesCloneCommand,
    SitesDeleteCommand,
    SitesResetCommand,
    SitesPhpAllocationCommand,
    EnvListCommand,
    EnvPushCommand,
    EnvCreateCommand,
    EnvCloneCommand,
    EnvDeleteCommand,
    EnvPhpAllocationCommand,
    EnvWebrootCommand,
    EnvFilesCommand,
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
    BackupsDownloadableListCommand,
    BackupsDownloadableCreateCommand,
    BackupsDownloadableQuotaCommand,
    DomainsListCommand,
    DomainsAddCommand,
    DomainsRemoveCommand,
    DomainsPrimaryCommand,
    DomainsVerificationCommand,
    DnsZonesCommand,
    DnsRecordsListCommand,
    DnsRecordsAddCommand,
    DnsRecordsUpdateCommand,
    DnsRecordsDeleteCommand,
    WpRunCommand,
    WpLoginCommand,
    WpUserCreateCommand,
    WpUserExistsCommand,
    DbLoginCommand,
    SearchReplaceCommand,
];

export const GROUPS: GroupDef[] = [
    {path: 'auth', description: 'Manage stored credentials'},
    {
        path: 'operations',
        description: 'Inspect and follow long-running Kinsta operations',
    },
    {path: 'sites', description: 'Manage Kinsta sites'},
    {path: 'env', description: 'List and manage environments of a site'},
    {path: 'cache', description: 'Clear the caches of a site environment'},
    {path: 'cache edge', description: 'Edge cache'},
    {path: 'cache cdn', description: 'CDN cache'},
    {path: 'php', description: 'Manage the PHP engine of a site environment'},
    {path: 'plugins', description: 'List and update WordPress plugins'},
    {path: 'themes', description: 'List and update WordPress themes'},
    {path: 'backups', description: 'List, create, restore and delete backups'},
    {path: 'backups downloadable', description: 'Downloadable backup archives'},
    {path: 'domains', description: 'Manage the domains of an environment'},
    {path: 'dns', description: 'Kinsta DNS zones and records'},
    {path: 'dns records', description: 'DNS records of a zone'},
    {path: 'wp', description: 'WordPress tools of an environment'},
    {path: 'wp user', description: 'WordPress admin users'},
    {path: 'db', description: 'Database tools of an environment'},
];
