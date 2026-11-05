import type {EndpointKey, RequestSpec} from '../request';

export function getOperation(id: string): RequestSpec {
    return {
        endpoint: 'GET /operations/{operation_id}',
        method: 'GET',
        path: `/operations/${encodeURIComponent(id)}`,
    };
}

export const ENDPOINTS: EndpointKey[] = ['GET /operations/{operation_id}'];
