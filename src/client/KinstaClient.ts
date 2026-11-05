import {
    type Operation,
    operationFor,
    startOperation,
} from '@/client/operations';
import type {RequestSpec} from '@/client/request';
import {HttpTransport, type TransportConfig} from '@/client/transport';

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

    /** Sends a request that must answer with an operation_id and returns a handle to wait on. */
    start(spec: RequestSpec): Promise<Operation> {
        return startOperation(this.transport, spec);
    }

    operation(id: string): Operation {
        return operationFor(this.transport, id);
    }
}
