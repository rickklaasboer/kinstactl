import type {components} from '@/client/generated/openapi';
import type {EndpointKey, RequestSpec} from '@/client/request';

type Schemas = components['schemas'];

export function listBackups(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/backups',
        method: 'GET',
        path: `/sites/environments/${encodeURIComponent(envId)}/backups`,
    };
}

export function createManualBackup(envId: string, tag?: string): RequestSpec {
    // The generated type marks defaulted fields as required; the API treats them as optional.
    const body: Partial<Schemas['AddManualBackupRequestBodySchema']> =
        tag !== undefined ? {tag} : {};
    return {
        endpoint: 'POST /sites/environments/{env_id}/manual-backups',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(envId)}/manual-backups`,
        body,
        creation: true,
    };
}

export function restoreBackup(
    targetEnvId: string,
    backupId: number,
    notifiedUserId: string,
): RequestSpec {
    const body: Schemas['RestoreSnapshotToEnvRequestBodySchema'] = {
        backup_id: backupId,
        notified_user_id: notifiedUserId,
    };
    return {
        endpoint: 'POST /sites/environments/{target_env_id}/backups/restore',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(targetEnvId)}/backups/restore`,
        body,
    };
}

export function deleteBackup(backupId: number): RequestSpec {
    return {
        endpoint: 'DELETE /sites/environments/backups/{backup_id}',
        method: 'DELETE',
        path: `/sites/environments/backups/${encodeURIComponent(String(backupId))}`,
    };
}

export function listDownloadableBackups(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/downloadable-backups',
        method: 'GET',
        path: `/sites/environments/${encodeURIComponent(envId)}/downloadable-backups`,
    };
}

export function createDownloadableBackup(envId: string): RequestSpec {
    return {
        endpoint: 'POST /sites/environments/{env_id}/downloadable-backups',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(envId)}/downloadable-backups`,
        creation: true,
    };
}

export function nextDownloadableBackup(envId: string): RequestSpec {
    return {
        endpoint:
            'GET /sites/environments/{env_id}/next-downloadable-backup-available',
        method: 'GET',
        path: `/sites/environments/${encodeURIComponent(envId)}/next-downloadable-backup-available`,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /sites/environments/{env_id}/backups',
    'POST /sites/environments/{env_id}/manual-backups',
    'POST /sites/environments/{target_env_id}/backups/restore',
    'DELETE /sites/environments/backups/{backup_id}',
    'GET /sites/environments/{env_id}/downloadable-backups',
    'POST /sites/environments/{env_id}/downloadable-backups',
    'GET /sites/environments/{env_id}/next-downloadable-backup-available',
];
