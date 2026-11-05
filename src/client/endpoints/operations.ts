import type { EndpointKey } from '@/client/request'

// The request itself is built by Operation.wait() in src/client/operations.ts.
export const ENDPOINTS: EndpointKey[] = ['GET /operations/{operation_id}']
