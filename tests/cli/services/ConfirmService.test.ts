import {describe, expect, test} from 'bun:test';
import {createContainer} from '@/cli/container';
import {CliError} from '@/cli/errors';
import type {Io} from '@/cli/io';
import type {Prompts} from '@/cli/prompts';
import {ConfirmService} from '@/cli/services/ConfirmService';

const site = {
    id: 's1',
    name: 'MY-SITE',
    displayName: 'My Site',
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
        progressOutput: process.stderr,
        prompts: prompts as Prompts,
    };
    return createContainer(io).resolve(ConfirmService);
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
        await runtime(false).confirmDestructive({
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
        await rt.confirmDestructive({...args, flags: base});
        expect(asked).toBe('Restart PHP on My Site (live)?');
    });

    test('interactive decline is CONFIRMATION_DECLINED', async () => {
        const rt = runtime(true, {confirm: async () => false});
        const e = await failure(rt.confirmDestructive({...args, flags: base}));
        expect(e.code).toBe('CONFIRMATION_DECLINED');
        expect(e.exitCode).toBe(5);
    });

    test('non-interactive without --yes requires confirmation', async () => {
        const e = await failure(
            runtime(false).confirmDestructive({...args, flags: base}),
        );
        expect(e.code).toBe('CONFIRMATION_REQUIRED');
        expect(e.hints).toContain('Pass --yes');
    });
});

describe('confirmDestructive: where', () => {
    test('where replaces the site phrase', async () => {
        let asked = '';
        const rt = runtime(true, {
            confirm: async (m) => {
                asked = m;
                return true;
            },
        });
        await rt.confirmDestructive({
            action: 'Delete record',
            where: 'zone example.com',
            level: 'confirm',
            flags: base,
        });
        expect(asked).toBe('Delete record on zone example.com?');
    });

    test('site or where is required', async () => {
        await expect(
            runtime(false).confirmDestructive({
                action: 'Delete record',
                level: 'confirm',
                flags: {...base, yes: true},
            }),
        ).rejects.toThrow('confirmDestructive: site or where is required');
    });

    test('irreversible without a site throws', async () => {
        await expect(
            runtime(false).confirmDestructive({
                action: 'Delete site',
                where: 'somewhere',
                level: 'irreversible',
                flags: base,
            }),
        ).rejects.toThrow('irreversible confirmation needs a site');
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
            runtime(false).confirmDestructive({
                ...args,
                flags: {...base, yes: true},
            }),
        );
        expect(e.code).toBe('CONFIRMATION_REQUIRED');
        expect(e.hints).toContain('--confirm MY-SITE');
    });

    test('--confirm with the site name passes, case-insensitive', async () => {
        await runtime(false).confirmDestructive({
            ...args,
            flags: {...base, confirm: 'my-site'},
        });
    });

    test('--confirm with another name is rejected', async () => {
        const e = await failure(
            runtime(false).confirmDestructive({
                ...args,
                flags: {...base, confirm: 'other'},
            }),
        );
        expect(e.code).toBe('CONFIRMATION_REQUIRED');
    });

    test('interactive typed name must match', async () => {
        const ok = runtime(true, {text: async () => 'my-site'});
        await ok.confirmDestructive({...args, flags: base});
        const bad = runtime(true, {text: async () => 'nope'});
        const e = await failure(bad.confirmDestructive({...args, flags: base}));
        expect(e.code).toBe('CONFIRMATION_DECLINED');
    });

    test('interactive ignores --yes and still asks for the name', async () => {
        let asked = false;
        const rt = runtime(true, {
            text: async () => {
                asked = true;
                return 'MY-SITE';
            },
        });
        await rt.confirmDestructive({
            ...args,
            flags: {...base, yes: true},
        });
        expect(asked).toBe(true);
    });
});
