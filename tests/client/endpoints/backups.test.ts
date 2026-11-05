import {expect, test} from 'bun:test';
import * as backups from '@/client/endpoints/backups';

test('listDownloadableBackups', () => {
    expect(backups.listDownloadableBackups('e 1')).toEqual({
        endpoint: 'GET /sites/environments/{env_id}/downloadable-backups',
        method: 'GET',
        path: '/sites/environments/e%201/downloadable-backups',
    });
});

test('createDownloadableBackup is a creation without a body', () => {
    const spec = backups.createDownloadableBackup('e1');
    expect(spec.endpoint).toBe(
        'POST /sites/environments/{env_id}/downloadable-backups',
    );
    expect(spec.method).toBe('POST');
    expect(spec.path).toBe('/sites/environments/e1/downloadable-backups');
    expect(spec.creation).toBe(true);
    expect(spec.body).toBeUndefined();
});

test('nextDownloadableBackup', () => {
    expect(backups.nextDownloadableBackup('e1')).toEqual({
        endpoint:
            'GET /sites/environments/{env_id}/next-downloadable-backup-available',
        method: 'GET',
        path: '/sites/environments/e1/next-downloadable-backup-available',
    });
});
