import {describe, expect, test} from 'bun:test';
import 'reflect-metadata';
import {PluginsListCommand} from '@/cli/commands/plugins/PluginsListCommand';
import {PluginsUpdateCommand} from '@/cli/commands/plugins/PluginsUpdateCommand';
import {ThemesListCommand} from '@/cli/commands/plugins/ThemesListCommand';
import {ThemesUpdateCommand} from '@/cli/commands/plugins/ThemesUpdateCommand';
import {WpItemService} from '@/cli/commands/plugins/WpItemService';
import type {Io} from '@/cli/io';
import {Output} from '@/cli/output';
import {createProgramContainer} from '@/cli/program';
import {OperationRunner} from '@/cli/services/OperationRunner';
import {SiteResolver} from '@/cli/services/SiteResolver';

const io: Io = {
    stdout() {},
    stderr() {},
    isTTY: false,
    env: {},
    progressOutput: process.stderr,
    prompts: {} as Io['prompts'],
};

describe('wp item commands without their own constructor', () => {
    test('inherit the constructor parameter types of the abstract base', () => {
        const paramtypes = (cls: object) =>
            Reflect.getMetadata('design:paramtypes', cls);
        expect(paramtypes(PluginsListCommand)).toEqual([
            SiteResolver,
            WpItemService,
            Output,
        ]);
        expect(paramtypes(ThemesUpdateCommand)).toEqual([
            SiteResolver,
            WpItemService,
            OperationRunner,
            Output,
        ]);
    });

    test('resolve with their dependencies and derive their text from the kind', () => {
        const container = createProgramContainer(io);
        const commands = [
            container.resolve(PluginsListCommand),
            container.resolve(PluginsUpdateCommand),
            container.resolve(ThemesListCommand),
            container.resolve(ThemesUpdateCommand),
        ];
        expect(commands.map((c) => c.name)).toEqual([
            'plugins list',
            'plugins update',
            'themes list',
            'themes update',
        ]);
        for (const c of commands)
            for (const dep of ['resolver', 'items', 'output'])
                expect(
                    (c as unknown as Record<string, unknown>)[dep],
                ).toBeDefined();
    });
});
