import type {EndpointKey, RequestSpec} from '@/client/request';

export function validate(): RequestSpec {
    return {endpoint: 'GET /validate', method: 'GET', path: '/validate'};
}

export function listCompanyUsers(companyId: string): RequestSpec {
    return {
        endpoint: 'GET /company/{id}/users',
        method: 'GET',
        path: `/company/${encodeURIComponent(companyId)}/users`,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /validate',
    'GET /company/{id}/users',
];
