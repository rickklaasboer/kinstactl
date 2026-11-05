import {describe, expect, test} from 'bun:test';
import {confirmDestructive} from '@/cli/confirm';
import {CliError} from '@/cli/errors';
import type {Io} from '@/cli/io';
import {Runtime} from '@/cli/runtime';
import type {Prompts} from '@/cli/prompts';

const site = {
    id: 's1',
    name: 'KLANT-X',
    displayName: 'Klant X',
    environments: [],
};
const env = {id: 'e1', name: 'live', displayName: 'Live', isLive: true};
const base = {wait: true, dryRun: false, yes: false};

function runtime(interactive: boolean, prompts: Partial<Prompts> = {}) {
    const io: Io = {
        stdout() {},
        stderr() {},
        isTTY: interactive,
        env: {},
        prompts: prompts as Prompts,
    };
    return new Runtime(io);
}

async function failure(p: Promise<void>): Promise<CliError> {
    try {
        await p;
    } catch (e) {
        if (e instanceof CliError) return e;
        throw e;
    }
    throw new Error('expected a CliError');
}

describe('confirmDestructive: confirm level', () => {
    const args = {action: 'Restart PHP', site, env, level: 'confirm' as const};

    test('--yes passes without prompting', async () => {
        await confirmDestructive(runtime(false), {
            ...args,
            flags: {...base, yes: true},
        });
    });

    test('interactive asks and accepts', async () => {
        let asked = '';
        const rt = runtime(true, {
            confirm: async (m) => {
                asked = m;
                return true;
            },
        });
        await confirmDestructive(rt, {...args, flags: base});
        expect(asked).toBe('Restart PHP on Klant X (live)?');
    });

    test('interactive decline is CONFIRMATION_DECLINED', async () => {
        const rt = runtime(true, {confirm: async () => false});
        const e = await failure(confirmDestructive(rt, {...args, flags: base}));
        expect(e.code).toBe('CONFIRMATION_DECLINED');
        expect(e.exitCode).toBe(5);
    });

    test('non-interactive without --yes requires confirmation', async () => {
        const e = await failure(
            confirmDestructive(runtime(false), {...args, flags: base}),
        );
        expect(e.code).toBe('CONFIRMATION_REQUIRED');
        expect(e.hints).toContain('Pass --yes');
    });
});

describe('confirmDestructive: irreversible level', () => {
    const args = {
        action: 'Delete site',
        site,
        level: 'irreversible' as const,
    };

    test('--yes alone is rejected', async () => {
        const e = await failure(
            confirmDestructive(runtime(false), {
                ...args,
                flags: {...base, yes: true},
            }),
        );
        expect(e.code).toBe('CONFIRMATION_REQUIRED');
        expect(e.hints).toContain('--confirm KLANT-X');
    });

    test('--confirm with the site name passes, case-insensitive', async () => {
        await confirmDestructive(runtime(false), {
            ...args,
            flags: {...base, confirm: 'klant-x'},
        });
    });

    test('--confirm with another name is rejected', async () => {
        const e = await failure(
            confirmDestructive(runtime(false), {
                ...args,
                flags: {...base, confirm: 'other'},
            }),
        );
        expect(e.code).toBe('CONFIRMATION_REQUIRED');
    });

    test('interactive typed name must match', async () => {
        const ok = runtime(true, {text: async () => 'klant-x'});
        await confirmDestructive(ok, {...args, flags: base});
        const bad = runtime(true, {text: async () => 'nope'});
        const e = await failure(
            confirmDestructive(bad, {...args, flags: base}),
        );
        expect(e.code).toBe('CONFIRMATION_DECLINED');
    });

    test('interactive ignores --yes and still asks for the name', async () => {
        let asked = false;
        const rt = runtime(true, {
            text: async () => {
                asked = true;
                return 'KLANT-X';
            },
        });
        await confirmDestructive(rt, {
            ...args,
            flags: {...base, yes: true},
        });
        expect(asked).toBe(true);
    });
});
