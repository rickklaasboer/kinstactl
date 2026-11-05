import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';

test('the image copies the binary with its executable bit set explicitly', () => {
    // upload-artifact does not preserve file modes, so the release image
    // would otherwise ship a non-executable binary.
    const copy = readFileSync('Dockerfile', 'utf8')
        .split('\n')
        .find((line) => line.startsWith('COPY') && line.includes('dist/bin/'));
    expect(copy).toContain('--chmod=755');
});
