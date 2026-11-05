import {describe, expect, test} from 'bun:test';
import {Command, CommanderError} from 'commander';
import {injectable} from 'tsyringe';
import {
    type BaseCommand,
    type CommandArgs,
    type ArgumentDef,
    type OptionDef,
} from '@/cli/commands/BaseCommand';
import {COMMANDS} from '@/cli/commands/index';
import {
    CommandRegistry,
    GLOBAL_OPTIONS,
    ROOT_DESCRIPTION,
} from '@/cli/CommandRegistry';
import {createContainer} from '@/cli/container';
import type {Io} from '@/cli/io';
import {createProgramContainer} from '@/cli/program';
import type {EndpointKey} from '@/client/request';

interface Call {
    args: CommandArgs;
    opts: Record<string, unknown>;
}

const calls: Call[] = [];

abstract class Fixture implements BaseCommand {
    abstract readonly name: string;
    abstract readonly description: string;
    readonly arguments: ArgumentDef[] = [];
    readonly options: OptionDef[] = [];
    readonly examples: string[] = [];
    readonly endpoints: EndpointKey[] = [];

    execute(args: CommandArgs, options: Record<string, unknown>): void {
        calls.push({args, opts: options});
    }
}

@injectable()
class GrpDo extends Fixture {
    readonly name = 'grp do';
    readonly description = 'Do the thing';
    readonly arguments: ArgumentDef[] = [
        {name: 'site', required: true, description: 'site name'},
        {name: 'backup-id', required: false, description: 'backup id'},
    ];
    readonly options: OptionDef[] = [
        {flags: '--env <name>', description: 'environment'},
        {
            flags: '--lines <n>',
            description: 'number of lines',
            parse: Number,
            default: 1000,
        },
        {flags: '--no-db', description: 'skip the database'},
        {flags: '--path <path...>', description: 'paths'},
    ];
    readonly examples = ['kinstactl grp do x', 'kinstactl grp do y --env live'];
    readonly endpoints: EndpointKey[] = ['GET /validate'];
}

@injectable()
class GrpSubRun extends Fixture {
    readonly name = 'grp sub run';
    readonly description = 'Run it';
    readonly arguments: ArgumentDef[] = [
        {
            name: 'type',
            required: false,
            description: 'log type',
            choices: ['error', 'access'],
            default: 'error',
        },
    ];
    readonly examples = ['kinstactl grp sub run'];
}

@injectable()
class GrpSubDrop extends Fixture {
    readonly name = 'grp sub drop';
    readonly description = 'Drop it';
    readonly examples = ['kinstactl grp sub drop'];
    readonly destructive = 'confirm' as const;
}

const GROUPS = [
    {path: 'grp', description: 'Group things'},
    {path: 'grp sub', description: 'Sub things'},
];

function io(): Io {
    return {
        stdout() {},
        stderr() {},
        isTTY: false,
        env: {},
        progressOutput: process.stderr,
        prompts: {} as Io['prompts'],
    };
}

function setup(groups = GROUPS) {
    const registry = new CommandRegistry(
        createContainer(io()),
        [GrpDo, GrpSubRun, GrpSubDrop],
        groups,
    );
    let out = '';
    const program = new Command('kinstactl').exitOverride().configureOutput({
        writeOut: (s) => {
            out += s;
        },
        writeErr: () => {},
        getOutHasColors: () => false,
        getErrHasColors: () => false,
    });
    return {registry, program, out: () => out};
}

function attachAll(registry: CommandRegistry, program: Command): void {
    for (const c of registry.commands()) registry.attach(program, c);
}

describe('CommandRegistry', () => {
    test('attach creates missing groups with their descriptions, in first-use order', () => {
        const {registry, program} = setup();
        attachAll(registry, program);
        const grp = program.commands[0]!;
        expect(grp.name()).toBe('grp');
        expect(grp.description()).toBe('Group things');
        expect(grp.commands.map((c) => c.name())).toEqual(['do', 'sub']);
        const sub = grp.commands[1]!;
        expect(sub.description()).toBe('Sub things');
        expect(sub.commands.map((c) => c.name())).toEqual(['run', 'drop']);
    });

    test('attach throws for a group without a description', () => {
        const {registry, program} = setup([GROUPS[0]!]);
        const [first, second] = registry.commands();
        registry.attach(program, first!);
        expect(() => registry.attach(program, second!)).toThrow(Error);
    });

    test('arguments arrive camelCased and options parsed', async () => {
        const {registry, program} = setup();
        attachAll(registry, program);
        calls.length = 0;
        await program.parseAsync(
            [
                'grp',
                'do',
                'klant-x',
                '42',
                '--lines',
                '5',
                '--no-db',
                '--path',
                'a',
                'b',
            ],
            {from: 'user'},
        );
        expect(calls[0]!.args).toEqual({site: 'klant-x', backupId: '42'});
        expect(calls[0]!.opts.lines).toBe(5);
        expect(calls[0]!.opts.db).toBe(false);
        expect(calls[0]!.opts.path).toEqual(['a', 'b']);

        await program.parseAsync(['grp', 'do', 'klant-x'], {from: 'user'});
        expect(calls[1]!.args.site).toBe('klant-x');
        expect(calls[1]!.opts.lines).toBe(1000);
    });

    test('argument choices and defaults apply', async () => {
        const {registry, program} = setup();
        attachAll(registry, program);
        calls.length = 0;
        await program.parseAsync(['grp', 'sub', 'run'], {from: 'user'});
        expect(calls[0]!.args.type).toBe('error');
        const err = await program
            .parseAsync(['grp', 'sub', 'run', 'nope'], {from: 'user'})
            .then(
                () => undefined,
                (e: unknown) => e,
            );
        expect(err).toBeInstanceOf(CommanderError);
        expect((err as CommanderError).code).toBe('commander.invalidArgument');
    });

    test('help ends with the examples', () => {
        const {registry, program, out} = setup();
        attachAll(registry, program);
        expect(() =>
            program.parse(['grp', 'do', '--help'], {from: 'user'}),
        ).toThrow(CommanderError);
        expect(
            out().endsWith(
                '\nExamples:\n  $ kinstactl grp do x\n  $ kinstactl grp do y --env live\n',
            ),
        ).toBe(true);
    });

    test('tree describes groups, leaves, global options, endpoints and destructive', () => {
        const {registry} = setup();
        const globals = GLOBAL_OPTIONS.map((o) => ({
            flags: o.flags,
            description: o.description,
        }));
        expect(registry.tree()).toEqual({
            name: 'kinstactl',
            path: '',
            description: ROOT_DESCRIPTION,
            arguments: [],
            options: globals,
            destructive: null,
            endpoints: [],
            commands: [
                {
                    name: 'grp',
                    path: 'grp',
                    description: 'Group things',
                    arguments: [],
                    options: [],
                    destructive: null,
                    endpoints: [],
                    commands: [
                        {
                            name: 'do',
                            path: 'grp do',
                            description: 'Do the thing',
                            arguments: [
                                {
                                    name: 'site',
                                    required: true,
                                    description: 'site name',
                                },
                                {
                                    name: 'backup-id',
                                    required: false,
                                    description: 'backup id',
                                },
                            ],
                            options: [
                                {
                                    flags: '--env <name>',
                                    description: 'environment',
                                },
                                {
                                    flags: '--lines <n>',
                                    description: 'number of lines',
                                },
                                {
                                    flags: '--no-db',
                                    description: 'skip the database',
                                },
                                {
                                    flags: '--path <path...>',
                                    description: 'paths',
                                },
                                ...globals,
                            ],
                            destructive: null,
                            endpoints: ['GET /validate'],
                            commands: [],
                        },
                        {
                            name: 'sub',
                            path: 'grp sub',
                            description: 'Sub things',
                            arguments: [],
                            options: [],
                            destructive: null,
                            endpoints: [],
                            commands: [
                                {
                                    name: 'run',
                                    path: 'grp sub run',
                                    description: 'Run it',
                                    arguments: [
                                        {
                                            name: 'type',
                                            required: false,
                                            description: 'log type',
                                        },
                                    ],
                                    options: globals,
                                    destructive: null,
                                    endpoints: [],
                                    commands: [],
                                },
                                {
                                    name: 'drop',
                                    path: 'grp sub drop',
                                    description: 'Drop it',
                                    arguments: [],
                                    options: globals,
                                    destructive: 'confirm',
                                    endpoints: [],
                                    commands: [],
                                },
                            ],
                        },
                    ],
                },
            ],
        });
    });

    test('site is optional unless another positional follows it', () => {
        for (const entry of COMMANDS) {
            const command = createProgramContainer(io()).resolve(entry);
            const index = command.arguments.findIndex((a) => a.name === 'site');
            if (index === -1) continue;
            const isLast = index === command.arguments.length - 1;
            expect({
                command: command.name,
                required: command.arguments[index]?.required,
            }).toEqual({command: command.name, required: !isLast});
        }
    });

    test('every command class resolves from a fresh container', () => {
        for (const entry of COMMANDS) {
            const command = createProgramContainer(io()).resolve(entry);
            expect(command.name).not.toBe('');
        }
    });

    test('destructive metadata matches the confirmation flags', () => {
        for (const entry of COMMANDS) {
            const command = createProgramContainer(io()).resolve(entry);
            const flags = command.options.map((o) => o.flags);
            expect({
                command: command.name,
                yes: flags.some((f) => f.startsWith('--yes')),
                confirm: flags.includes('--confirm <site-name>'),
            }).toEqual({
                command: command.name,
                yes: command.destructive === 'confirm',
                confirm: command.destructive === 'irreversible',
            });
        }
    });
});
