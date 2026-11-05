import type {Command} from 'commander';
import {InvalidArgumentError} from 'commander';
import {Listr, ListrLogger, PRESET_TIMER, ProcessOutput} from 'listr2';
import type {Operation} from '@/client/operations';
import type {RequestSpec} from '@/client/request';
import type {Runtime} from './runtime';
import type {EnvRef, SiteRef} from './siteCache';

export interface ActionFlags {
    /** --no-wait sets this to false; Commander omits it when the flag is not registered. */
    wait: boolean;
    dryRun: boolean;
    yes: boolean;
    confirm?: string;
    /** Minutes. */
    timeout?: number;
}

const DEFAULT_TIMEOUT_MINUTES = 30;

export function parseMinutes(v: string): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0)
        throw new InvalidArgumentError('must be a positive number of minutes');
    return n;
}

export function addActionFlags(
    cmd: Command,
    o: {
        dryRun?: boolean;
        wait?: boolean;
        destructive?: 'confirm' | 'irreversible';
    },
): Command {
    if (o.dryRun !== false)
        cmd.option(
            '--dry-run',
            'print the resolved target and request; change nothing',
        );
    if (o.wait !== false) {
        cmd.option('--no-wait', 'return the operation ID instead of waiting');
        cmd.option(
            '--timeout <minutes>',
            `give up waiting after this many minutes (default ${DEFAULT_TIMEOUT_MINUTES})`,
            parseMinutes,
        );
    }
    if (o.destructive === 'confirm')
        cmd.option('--yes', 'skip the confirmation prompt');
    if (o.destructive === 'irreversible')
        cmd.option(
            '--confirm <site-name>',
            'the site name, to confirm an irreversible action',
        );
    return cmd;
}

/**
 * Waits for an operation, with a listr2 task only when interactive. Rendering failures (e.g. EPIPE)
 * must not abort the operation: the wait runs outside the renderer and its outcome is the result.
 */
export async function waitForOperation(
    rt: Runtime,
    op: Operation,
    title: string,
    timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
): Promise<void> {
    const waiting = op.wait({
        timeoutMs: timeoutMinutes * 60_000,
        sleep: rt.sleep,
        now: () => rt.now(),
    });

    if (!rt.interactive) {
        rt.output.info(`Waiting for ${title} (operation ${op.id})...`);
        await waiting;
        rt.output.info(`${title} completed`);
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
                    process.stderr,
                    process.stderr,
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
        rt.output.info(
            `Progress display failed (${renderError instanceof Error ? renderError.message : String(renderError)}); the operation itself completed`,
        );
}

export async function runOperation(
    rt: Runtime,
    args: {
        title: string;
        spec: RequestSpec;
        target?: {site: SiteRef; env?: EnvRef};
        flags: ActionFlags;
    },
): Promise<void> {
    const {title, spec, target, flags} = args;

    if (flags.dryRun) {
        const request = {
            method: spec.method,
            path: spec.path,
            query: spec.query,
            body: spec.body,
        };
        rt.output.data(
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
                if (spec.body !== undefined)
                    lines.push(`Body:    ${JSON.stringify(spec.body)}`);
                lines.push('Nothing was sent.');
                return lines.join('\n');
            },
        );
        return;
    }

    const op = await rt.client().start(spec);

    // Commander omits `wait` for commands without --no-wait; only an explicit false skips waiting.
    if (flags.wait === false) {
        rt.output.success(`Started ${title}`, {
            operation_id: op.id,
            status: 'pending',
        });
        rt.output.info(`Follow with: kinstactl operations wait ${op.id}`);
        return;
    }

    await waitForOperation(rt, op, title, flags.timeout);
    rt.output.success(`${title} completed`, {
        operation_id: op.id,
        status: 'completed',
    });
}
