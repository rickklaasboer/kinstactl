import pc from 'picocolors';
import type {CliError} from './errors';
import {renderTable} from './table';

export interface Column<T> {
    header: string;
    value: (r: T) => string;
    color?: (r: T) => (s: string) => string;
}

export interface OutputSink {
    stdout: (s: string) => void;
    stderr: (s: string) => void;
    /** Read on every call: the flag is only known after Commander parsed the arguments. */
    json: () => boolean;
    color: boolean;
}

export class Output {
    private readonly c: ReturnType<typeof pc.createColors>;

    readonly color: boolean;

    constructor(private readonly sink: OutputSink) {
        this.color = sink.color;
        this.c = pc.createColors(sink.color);
    }

    table<T>(rows: T[], columns: Column<T>[], json?: unknown): void {
        if (this.sink.json()) {
            this.sink.stdout(`${JSON.stringify(json ?? rows)}\n`);
            return;
        }
        const cells = rows.map((r) =>
            columns.map((col) => {
                const text = col.value(r);
                return col.color ? col.color(r)(text) : text;
            }),
        );
        this.sink.stdout(
            `${renderTable(
                columns.map((col) => this.c.bold(col.header)),
                cells,
            )}\n`,
        );
    }

    data(json: unknown, human: () => string): void {
        this.sink.stdout(
            `${this.sink.json() ? JSON.stringify(json) : human()}\n`,
        );
    }

    info(msg: string): void {
        if (this.sink.json()) return;
        this.sink.stderr(`${msg}\n`);
    }

    success(msg: string, json?: unknown): void {
        if (this.sink.json()) {
            if (json !== undefined)
                this.sink.stdout(`${JSON.stringify(json)}\n`);
            return;
        }
        this.sink.stdout(`${this.c.green('✔')} ${msg}\n`);
    }

    error(e: CliError): void {
        if (this.sink.json()) {
            this.sink.stderr(
                `${JSON.stringify({
                    error: {code: e.code, message: e.message, hints: e.hints},
                })}\n`,
            );
            return;
        }
        this.sink.stderr(`${this.c.red(e.message)}\n`);
        for (const hint of e.hints) this.sink.stderr(`${this.c.dim(hint)}\n`);
    }
}
