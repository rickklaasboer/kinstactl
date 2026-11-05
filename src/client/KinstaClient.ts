import {type Operation, operationFor, startOperation} from './operations';
import type {RequestSpec} from './request';
import {
    HttpTransport,
    type RawResponse,
    type TransportConfig,
} from './transport';

export interface KinstaClientOptions extends TransportConfig {
    companyId: string;
}

export class KinstaClient {
    readonly companyId: string;
    private readonly transport: HttpTransport;

    constructor(opts: KinstaClientOptions) {
        const {companyId, ...transportConfig} = opts;
        this.companyId = companyId;
        this.transport = new HttpTransport(transportConfig);
    }

    send<T = unknown>(spec: RequestSpec): Promise<T> {
        return this.transport.send<T>(spec);
    }

    /** Like send, but keeps the status and does not throw on HTTP errors. */
    raw(spec: RequestSpec): Promise<RawResponse> {
        return this.transport.raw(spec);
    }

    /** Sends a request that must answer with an operation_id and returns a handle to wait on. */
    start(spec: RequestSpec): Promise<Operation> {
        return startOperation(this.transport, spec);
    }

    operation(id: string): Operation {
        return operationFor(this.transport, id);
    }
}
