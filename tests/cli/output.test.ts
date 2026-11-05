import {describe, expect, test} from 'bun:test';
import {CliError} from '@/cli/errors';
import {Output} from '@/cli/output';
import {renderTable} from '@/cli/table';

function make(json: boolean) {
    const out: string[] = [];
    const err: string[] = [];
    const output = new Output({
        stdout: (s) => out.push(s),
        stderr: (s) => err.push(s),
        json: () => json,
        color: false,
    });
    return {output, out: () => out.join(''), err: () => err.join('')};
}

describe('Output', () => {
    const cols = [
        {header: 'NAME', value: (r: {n: string; c: string}) => r.n},
        {header: 'COMPANY', value: (r: {n: string; c: string}) => r.c},
    ];
    const rows = [
        {n: 'work', c: 'c1'},
        {n: 'personal-long', c: 'c2'},
    ];

    test('table pads columns in human mode', () => {
        const {output, out} = make(false);
        output.table(rows, cols);
        expect(out().split('\n')).toEqual([
            'NAME           COMPANY',
            'work           c1',
            'personal-long  c2',
            '',
        ]);
    });

    test('column color names map to the output palette', () => {
        const out: string[] = [];
        const output = new Output({
            stdout: (s) => out.push(s),
            stderr: () => {},
            json: () => false,
            color: true,
        });
        output.table(
            [{n: 'a'}],
            [
                {header: 'R', value: (r) => r.n, color: () => 'red'},
                {header: 'Y', value: (r) => r.n, color: () => 'yellow'},
                {header: 'G', value: (r) => r.n, color: () => 'green'},
                {header: 'D', value: (r) => r.n, color: () => 'dim'},
            ],
        );
        const text = out.join('');
        expect(text).toContain('\x1b[31ma\x1b[39m');
        expect(text).toContain('\x1b[33ma\x1b[39m');
        expect(text).toContain('\x1b[32ma\x1b[39m');
        expect(text).toContain('\x1b[2ma\x1b[22m');
    });

    test('table prints only the rows as JSON in json mode', () => {
        const {output, out, err} = make(true);
        output.table(rows, cols);
        expect(out()).toBe(`${JSON.stringify(rows)}\n`);
        expect(err()).toBe('');
    });

    test('table uses the explicit json payload when given', () => {
        const {output, out} = make(true);
        output.table(rows, cols, {items: 2});
        expect(out()).toBe('{"items":2}\n');
    });

    test('error in json mode goes to stderr as JSON and leaves stdout empty', () => {
        const {output, out, err} = make(true);
        output.error(
            new CliError('SITE_NOT_FOUND', 'Site not found', ['my-site']),
        );
        expect(out()).toBe('');
        expect(JSON.parse(err())).toEqual({
            error: {
                code: 'SITE_NOT_FOUND',
                message: 'Site not found',
                hints: ['my-site'],
            },
        });
    });

    test('error in human mode prints message and hints on stderr', () => {
        const {output, out, err} = make(false);
        output.error(
            new CliError('SITE_NOT_FOUND', 'Site not found', ['my-site']),
        );
        expect(out()).toBe('');
        expect(err()).toContain('Site not found');
        expect(err()).toContain('my-site');
    });

    test('info is silent in json mode and goes to stderr otherwise', () => {
        const a = make(true);
        a.output.info('working');
        expect([a.out(), a.err()]).toEqual(['', '']);
        const b = make(false);
        b.output.info('working');
        expect([b.out(), b.err()]).toEqual(['', 'working\n']);
    });

    test('json getter follows the sink', () => {
        expect(make(true).output.json).toBe(true);
        expect(make(false).output.json).toBe(false);
    });

    test('data and success switch on json mode', () => {
        const a = make(true);
        a.output.data({a: 1}, () => 'human');
        a.output.success('done', {ok: true});
        expect(a.out()).toBe('{"a":1}\n{"ok":true}\n');
        const b = make(false);
        b.output.data({a: 1}, () => 'human');
        b.output.success('done');
        expect(b.out()).toBe('human\n✔ done\n');
    });
});

describe('renderTable', () => {
    test('measures visible width, ignoring ANSI codes', () => {
        const red = (s: string) => `\x1b[31m${s}\x1b[39m`;
        const text = renderTable(
            ['A', 'B'],
            [
                [red('xx'), 'y'],
                ['zzzz', 'w'],
            ],
        );
        const stripped = text.replace(
            new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'),
            '',
        );
        expect(stripped.split('\n')).toEqual(['A     B', 'xx    y', 'zzzz  w']);
    });
});
