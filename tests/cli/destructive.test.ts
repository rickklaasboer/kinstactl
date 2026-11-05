import {expect, test} from 'bun:test';
import {CommandRegistry} from '@/cli/CommandRegistry';
import type {Io} from '@/cli/io';
import {createProgramContainer} from '@/cli/program';

const byName = (a: [string, string], b: [string, string]) =>
    a[0].localeCompare(b[0]);

const EXPECTED = (<[string, string][]>[
    ['sites delete', 'irreversible'],
    ['sites reset', 'irreversible'],
    ['env delete', 'irreversible'],
    ['backups delete', 'confirm'],
    ['backups restore', 'confirm'],
    ['env push', 'confirm'],
    ['domains remove', 'confirm'],
    ['domains primary', 'confirm'],
    ['dns records delete', 'confirm'],
    ['sftp-users delete', 'confirm'],
    ['security bot-protection exceptions delete', 'confirm'],
    ['wp run', 'confirm'],
    ['search-replace', 'confirm'],
    ['security denied-ips', 'confirm'],
    ['security redirects update', 'confirm'],
    ['security redirects delete', 'confirm'],
]).sort(byName);

test('the destructive commands are exactly the spec set', () => {
    const io: Io = {
        stdout() {},
        stderr() {},
        isTTY: false,
        env: {},
        progressOutput: process.stderr,
        prompts: {} as Io['prompts'],
    };
    const actual = createProgramContainer(io)
        .resolve(CommandRegistry)
        .commands()
        .flatMap((c): [string, string][] =>
            c.destructive ? [[c.name, c.destructive]] : [],
        )
        .sort(byName);
    expect(actual).toEqual(EXPECTED);
});
