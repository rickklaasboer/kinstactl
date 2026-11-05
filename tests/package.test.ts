import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

test('bin and library entry points live in dist', () => {
    expect(pkg.bin.kinstactl).toBe('dist/kinstactl.js');
    expect(pkg.exports['.']).toEqual({
        types: './dist/index.d.ts',
        default: './dist/index.js',
    });
    expect(pkg.types).toBe('./dist/index.d.ts');
});

test('the tarball ships dist without binaries', () => {
    expect(pkg.files).toEqual(['dist', '!dist/bin']);
});

test('the package has no runtime dependencies', () => {
    expect(pkg.dependencies).toBeUndefined();
});

test('node 22 is the floor', () => {
    expect(pkg.engines.node).toBe('>=22');
});

test('packing builds first', () => {
    expect(pkg.scripts.prepack).toBe('bun run build');
});
