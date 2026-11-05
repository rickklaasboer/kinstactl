import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runCli} from '../helpers/runCli';

const version: string = JSON.parse(
    readFileSync('package.json', 'utf8'),
).version;

test('--version prints the package version', async () => {
    const r = await runCli(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(`${version}\n`);
    expect(r.stderr).toBe('');
});

test('-V is the short flag', async () => {
    const r = await runCli(['-V']);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe(`${version}\n`);
});
