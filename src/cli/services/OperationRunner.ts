import {InvalidArgumentError} from 'commander';
import {Listr, ListrLogger, PRESET_TIMER, ProcessOutput} from 'listr2';
import {inject, Lifecycle, scoped} from 'tsyringe';
import type {Operation} from '@/client/operations';
import type {RequestSpec} from '@/client/request';
import type {Destructive, OptionDef} from '../commands/BaseCommand';
import {IO, type Io} from '../io';
import {Output} from '../output';
import {ClientProvider} from './ClientProvider';
import {ConfirmService} from './ConfirmService';
import {RunContext} from './RunContext';
import type {EnvRef, SiteRef} from './SiteCache';

export interface ActionFlags {
    /** --no-wait sets this to false; Commander omits it when the flag is not registered. */
    wait: boolean;
    dryRun: boolean;
    yes: boolean;
    confirm?: string;
    /** Minutes. */
    timeout?: number;
}

export const DEFAULT_TIMEOUT_MINUTES = 30;

export function parseMinutes(v: string): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0)
        throw new InvalidArgumentError('must be a positive number of minutes');
    return n;
}

/** The flags every operation command shares; spread last into its options. */
export function actionOptions(o: {
    dryRun?: boolean;
    wait?: boolean;
    destructive?: Destructive;
}): OptionDef[] {
    const defs: OptionDef[] = [];
    if (o.dryRun !== false)
        defs.push({
            flags: '--dry-run',
            description:
                'print the resolved target and request; change nothing',
        });
    if (o.wait !== false) {
        defs.push({
            flags: '--no-wait',
            description: 'return the operation ID instead of waiting',
        });
        defs.push({
            flags: '--timeout <minutes>',
            description: `give up waiting after this many minutes (default ${DEFAULT_TIMEOUT_MINUTES})`,
            parse: parseMinutes,
        });
    }
    if (o.destructive === 'confirm')
        defs.push({
            flags: '--yes',
            description: 'skip the confirmation prompt',
        });
    if (o.destructive === 'irreversible')
        defs.push({
            flags: '--confirm <site-name>',
            description: 'the site name, to confirm an irreversible action',
        });
    return defs;
}

export interface RunOperationArgs {
    title: string;
    spec: RequestSpec;
    target?: {site: SiteRef; env?: EnvRef};
    flags: ActionFlags;
    /** Destructive actions: dry-run returns first, then this confirms, then the request is sent. */
    confirm?: {action: string; level: Destructive};
    /** Applied to the body shown by --dry-run (JSON and human), never to the body that is sent. */
    redact?: (body: unknown) => unknown;
}

/** Runs an API operation: dry-run, confirmation, request, then waiting. */
@scoped(Lifecycle.ContainerScoped)
export class OperationRunner {
    constructor(
        @inject(IO) private readonly io: Io,
        private readonly ctx: RunContext,
        private readonly output: Output,
        private readonly clients: ClientProvider,
        private readonly confirmer: ConfirmService,
    ) {}

    /**
     * Waits for an operation, with a listr2 task only when interactive. Rendering failures (e.g. EPIPE)
     * must not abort the operation: the wait runs outside the renderer and its outcome is the result.
     */
    async wait(
        op: Operation,
        title: string,
        timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
    ): Promise<void> {
        const waiting = op.wait({
            timeoutMs: timeoutMinutes * 60_000,
            sleep: this.ctx.sleep,
            now: () => this.ctx.now(),
        });

        if (!this.ctx.interactive) {
            this.output.info(`Waiting for ${title} (operation ${op.id})...`);
            await waiting;
            this.output.info(`${title} completed`);
            return;
        }

        let renderError: unknown;
        const render = new Listr([{title, task: () => waiting}], {
            concurrent: false,
            rendererOptions: {
                timer: PRESET_TIMER,
                // Keep stdout clean for result output.
                logger: new ListrLogger({
                    processOutput: new ProcessOutput(
                        this.io.progressOutput,
                        this.io.progressOutput,
                    ),
                }),
            },
        })
            .run()
            .catch((e: unknown) => {
                renderError = e;
            });
        // An operation failure rejects both promises; the operation's own error is the one to report.
        await waiting;
        await render;
        if (renderError !== undefined)
            this.output.info(
                `Progress display failed (${renderError instanceof Error ? renderError.message : String(renderError)}); the operation itself completed`,
            );
    }

    async run(args: RunOperationArgs): Promise<void> {
        const {title, spec, target, flags, confirm, redact} = args;

        if (flags.dryRun) {
            const body =
                redact && spec.body !== undefined
                    ? redact(spec.body)
                    : spec.body;
            const request = {
                method: spec.method,
                path: spec.path,
                query: spec.query,
                body,
            };
            this.output.data(
                {
                    dry_run: true,
                    target: target && {
                        site: {id: target.site.id, name: target.site.name},
                        env: target.env && {
                            id: target.env.id,
                            name: target.env.name,
                        },
                    },
                    request,
                },
                () => {
                    const lines = [`Dry run: ${title}`];
                    if (target)
                        lines.push(
                            `Target:  ${target.site.name}${target.env ? ` (${target.env.name})` : ''}`,
                        );
                    lines.push(`Request: ${spec.method} ${spec.path}`);
                    if (spec.query)
                        lines.push(`Query:   ${JSON.stringify(spec.query)}`);
                    if (body !== undefined)
                        lines.push(`Body:    ${JSON.stringify(body)}`);
                    lines.push('Nothing was sent.');
                    return lines.join('\n');
                },
            );
            return;
        }

        if (confirm) {
            if (!target)
                throw new Error('runOperation: confirm requires a target');
            await this.confirmer.confirmDestructive({
                action: confirm.action,
                site: target.site,
                env: target.env,
                flags,
                level: confirm.level,
            });
        }

        const op = await this.clients.client().start(spec);

        // Commander omits `wait` for commands without --no-wait; only an explicit false skips waiting.
        if (flags.wait === false) {
            this.output.success(`Started ${title}`, {
                operation_id: op.id,
                status: 'pending',
            });
            this.output.info(`Follow with: kinstactl operations wait ${op.id}`);
            return;
        }

        await this.wait(op, title, flags.timeout);
        this.output.success(`${title} completed`, {
            operation_id: op.id,
            status: 'completed',
        });
    }
}
