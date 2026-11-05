import {expect, test} from 'bun:test';
import {
    artifactName,
    buildBinaries,
    checksumLine,
    TARGETS,
} from '../../scripts/build-binaries';

test('every spec platform has a target', () => {
    expect(Object.keys(TARGETS)).toEqual([
        'darwin-arm64',
        'darwin-x64',
        'linux-x64',
        'linux-arm64',
        'windows-x64',
    ]);
});

test('windows binaries get .exe', () => {
    expect(artifactName('windows-x64')).toBe('kinstactl-windows-x64.exe');
    expect(artifactName('linux-arm64')).toBe('kinstactl-linux-arm64');
});

test('checksum lines are sha256sum compatible', () => {
    expect(checksumLine('ab', 'kinstactl-linux-x64')).toBe(
        'ab  kinstactl-linux-x64',
    );
});

test('an unknown target is an error', () => {
    expect(() => buildBinaries(['plan9'])).toThrow(/plan9.*darwin-arm64/s);
});
