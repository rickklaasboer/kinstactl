import {CommanderError} from 'commander';
import {
    KinstaApiError,
    OperationFailedError,
    OperationTimeoutError,
} from '@/client/errors';

export type ErrorCode =
    | 'USAGE'
    | 'AUTH_MISSING'
    | 'AUTH_INVALID'
    | 'SITE_NOT_FOUND'
    | 'SITE_AMBIGUOUS'
    | 'ENV_REQUIRED'
    | 'ENV_NOT_FOUND'
    | 'CONFIRMATION_REQUIRED'
    | 'CONFIRMATION_DECLINED'
    | 'API_ERROR'
    | 'OPERATION_FAILED'
    | 'OPERATION_TIMEOUT';

const EXIT_CODES: Record<ErrorCode, number> = {
    USAGE: 2,
    AUTH_MISSING: 2,
    SITE_NOT_FOUND: 2,
    SITE_AMBIGUOUS: 2,
    ENV_REQUIRED: 2,
    ENV_NOT_FOUND: 2,
    API_ERROR: 1,
    AUTH_INVALID: 1,
    OPERATION_FAILED: 3,
    OPERATION_TIMEOUT: 4,
    CONFIRMATION_REQUIRED: 5,
    CONFIRMATION_DECLINED: 5,
};

export class CliError extends Error {
    readonly exitCode: number;

    constructor(
        readonly code: ErrorCode,
        message: string,
        readonly hints: string[] = [],
    ) {
        super(message);
        this.name = 'CliError';
        this.exitCode = EXIT_CODES[code];
    }
}

export function toCliError(e: unknown): CliError {
    if (e instanceof CliError) return e;
    if (e instanceof KinstaApiError) {
        if (e.status === 401)
            return new CliError('AUTH_INVALID', e.message, [
                'Run: kinstactl auth login',
            ]);
        return new CliError('API_ERROR', e.message);
    }
    if (e instanceof OperationFailedError)
        return new CliError('OPERATION_FAILED', e.message, [
            `Operation: ${e.operationId}`,
        ]);
    if (e instanceof OperationTimeoutError)
        return new CliError('OPERATION_TIMEOUT', e.message, [
            `Operation: ${e.operationId}`,
        ]);
    if (e instanceof CommanderError)
        return new CliError('USAGE', e.message.replace(/^error: /, ''));
    return new CliError(
        'API_ERROR',
        e instanceof Error ? e.message : String(e),
    );
}
