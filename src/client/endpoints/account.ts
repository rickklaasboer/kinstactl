import type {components} from '@/client/generated/openapi';
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

export function listRegions(companyId: string): RequestSpec {
    return {
        endpoint: 'GET /company/{id}/available-regions',
        method: 'GET',
        path: `/company/${encodeURIComponent(companyId)}/available-regions`,
    };
}

export function getCompanyUser(companyId: string, userId: string): RequestSpec {
    return {
        endpoint: 'GET /company/{id}/users/{id_user}',
        method: 'GET',
        path: `/company/${encodeURIComponent(companyId)}/users/${encodeURIComponent(userId)}`,
    };
}

export function listApiKeys(companyId: string): RequestSpec {
    return {
        endpoint: 'GET /company/{id}/api-keys',
        method: 'GET',
        path: `/company/${encodeURIComponent(companyId)}/api-keys`,
    };
}

export type ActivityCategory =
    | 'siteActions'
    | 'kinstaDns'
    | 'migrations'
    | 'billing'
    | 'notifications'
    | 'userManagement'
    | 'personalSettings'
    | 'samlSso';

export type ActivityLanguage =
    | 'da'
    | 'de'
    | 'en'
    | 'es'
    | 'fr'
    | 'it'
    | 'ja'
    | 'nl'
    | 'pt'
    | 'sv';

export interface ActivityLogsQuery {
    limit?: number;
    offset?: number;
    category?: ActivityCategory;
    siteId?: string;
    initiatedBy?: string;
    apiKeyId?: string;
    language?: ActivityLanguage;
}

export function listActivityLogs(
    companyId: string,
    query: ActivityLogsQuery = {},
): RequestSpec {
    const params: Record<string, string> = {};
    if (query.limit !== undefined) params.limit = String(query.limit);
    if (query.offset !== undefined) params.offset = String(query.offset);
    if (query.category !== undefined) params.category = query.category;
    if (query.siteId !== undefined) params.site_id = query.siteId;
    if (query.initiatedBy !== undefined)
        params.id_initiated_by = query.initiatedBy;
    if (query.apiKeyId !== undefined) params.id_api_key = query.apiKeyId;
    if (query.language !== undefined) params.language = query.language;
    const spec: RequestSpec = {
        endpoint: 'GET /company/{id}/activity-logs',
        method: 'GET',
        path: `/company/${encodeURIComponent(companyId)}/activity-logs`,
    };
    if (Object.keys(params).length > 0) spec.query = params;
    return spec;
}

export type CompanyRole =
    components['schemas']['SetCompanyCapabilityOfUserBodySchema']['role'];

export const COMPANY_ROLES: readonly CompanyRole[] = [
    'company-admin',
    'company-developer',
    'company-billing',
];

export function setCompanyRole(
    companyId: string,
    userId: string,
    role: CompanyRole,
): RequestSpec {
    const body: components['schemas']['SetCompanyCapabilityOfUserBodySchema'] =
        {user_id: userId, role};
    return {
        endpoint: 'POST /company/{company_id}/users/company-capabilities',
        method: 'POST',
        path: `/company/${encodeURIComponent(companyId)}/users/company-capabilities`,
        body,
    };
}

export type SiteRole = NonNullable<
    components['schemas']['SetSiteCapabilityOfUsersBodySchema']['site_capabilities'][number]['role']
>;

export const SITE_ROLES: readonly SiteRole[] = ['site-admin', 'site-developer'];

export function setSiteRoles(
    companyId: string,
    userIds: string[],
    siteCapabilities: {siteId: string; role: SiteRole}[],
): RequestSpec {
    const body: components['schemas']['SetSiteCapabilityOfUsersBodySchema'] = {
        user_ids: userIds,
        site_capabilities: siteCapabilities.map((c) => ({
            site_id: c.siteId,
            role: c.role,
        })),
    };
    return {
        endpoint: 'POST /company/{company_id}/users/site-capabilities',
        method: 'POST',
        path: `/company/${encodeURIComponent(companyId)}/users/site-capabilities`,
        body,
    };
}

// The spec documents a request body on these GETs; HttpTransport.raw refuses
// GET bodies, so none is sent and callers filter client-side.
export function listCompanyPlugins(companyId: string): RequestSpec {
    return {
        endpoint: 'GET /company/{id}/wp-plugins',
        method: 'GET',
        path: `/company/${encodeURIComponent(companyId)}/wp-plugins`,
    };
}

export function listCompanyThemes(companyId: string): RequestSpec {
    return {
        endpoint: 'GET /company/{id}/wp-themes',
        method: 'GET',
        path: `/company/${encodeURIComponent(companyId)}/wp-themes`,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /validate',
    'GET /company/{id}/users',
    'GET /company/{id}/available-regions',
    'GET /company/{id}/users/{id_user}',
    'GET /company/{id}/api-keys',
    'GET /company/{id}/activity-logs',
    'POST /company/{company_id}/users/company-capabilities',
    'POST /company/{company_id}/users/site-capabilities',
    'GET /company/{id}/wp-plugins',
    'GET /company/{id}/wp-themes',
];
