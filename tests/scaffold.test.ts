import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { paths } from '@/client/generated/openapi';

type V = paths['/validate']['get'];

function tsFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            return entry.name === 'generated' ? [] : tsFiles(full);
        }
        return entry.name.endsWith('.ts') ? [full] : [];
    });
}

describe('scaffold', () => {
    test('generated types expose /validate', () => {
        const operation: V | undefined = undefined;
        expect(operation).toBeUndefined();
        expect(readFileSync('openapi/kinsta-openapi.yaml', 'utf8')).toContain('version: 1.122.0');
    });

    test('src has no Bun-only APIs', () => {
        const hits = tsFiles('src').filter((file) => {
            const source = readFileSync(file, 'utf8');
            return /\bBun\./.test(source) || /from 'bun:/.test(source);
        });
        expect(hits).toEqual([]);
    });
});
