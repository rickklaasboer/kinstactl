export class KinstaApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public body: unknown = null,
    ) {
        super(message);
        this.name = 'KinstaApiError';
    }
}

export class OperationFailedError extends Error {
    constructor(
        public operationId: string,
        message: string,
    ) {
        super(message);
        this.name = 'OperationFailedError';
    }
}

export class OperationTimeoutError extends Error {
    constructor(
        public operationId: string,
        message: string,
    ) {
        super(message);
        this.name = 'OperationTimeoutError';
    }
}
