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

test('the docs image serves the built site through the pinned caddy', () => {
    const lines = readFileSync('docs/Dockerfile', 'utf8').split('\n');
    expect(lines[0]).toBe('FROM caddy:2.11.7-alpine');
    expect(lines).toContain('COPY dist /srv');
    expect(
        readFileSync('docs/.dockerignore', 'utf8').trim().split('\n'),
    ).toEqual(['*', '!dist', '!Caddyfile']);
});
