import type {components} from '../generated/openapi.js';
import type {EndpointKey, RequestSpec} from '../request.js';

type Schemas = components['schemas'];

export interface AddSiteDomainOptions {
    domainName: string;
    /** True also covers subdomains; the API field is the inverse, is_wildcardless. */
    wildcard?: boolean;
    withWww?: boolean;
    setupType?: 'quick' | 'avoid_downtime';
    customSslKey?: string;
    customSslCert?: string;
}

export function listSiteDomains(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/domains',
        method: 'GET',
        path: `/sites/environments/${encodeURIComponent(envId)}/domains`,
    };
}

export function addSiteDomain(
    envId: string,
    opts: AddSiteDomainOptions,
): RequestSpec {
    // The generated type marks defaulted fields as required; the API treats them as optional.
    const body: Partial<Schemas['AddSiteDomainRequestBodySchema']> = {
        domain_name: opts.domainName,
    };
    if (opts.wildcard !== undefined) body.is_wildcardless = !opts.wildcard;
    if (opts.withWww !== undefined) body.add_with_www_subdomain = opts.withWww;
    if (opts.setupType !== undefined) body.setup_type = opts.setupType;
    if (opts.customSslKey !== undefined)
        body.custom_ssl_key = opts.customSslKey;
    if (opts.customSslCert !== undefined)
        body.custom_ssl_cert = opts.customSslCert;
    return {
        endpoint: 'POST /sites/environments/{env_id}/domains',
        method: 'POST',
        path: `/sites/environments/${encodeURIComponent(envId)}/domains`,
        body,
    };
}

export function deleteSiteDomains(
    envId: string,
    domainIds: string[],
): RequestSpec {
    const body: Schemas['DeleteSiteDomainRequestBodySchema'] = {
        domain_ids: domainIds,
    };
    return {
        endpoint: 'DELETE /sites/environments/{env_id}/domains',
        method: 'DELETE',
        path: `/sites/environments/${encodeURIComponent(envId)}/domains`,
        body,
    };
}

export function getVerificationRecords(siteDomainId: string): RequestSpec {
    return {
        endpoint:
            'GET /sites/environments/domains/{site_domain_id}/verification-records',
        method: 'GET',
        path: `/sites/environments/domains/${encodeURIComponent(siteDomainId)}/verification-records`,
    };
}

export function changePrimaryDomain(
    envId: string,
    domainId: string,
    runSearchAndReplace: boolean,
): RequestSpec {
    const body: Schemas['ChangePrimaryDomainRequestBodySchema'] = {
        domain_id: domainId,
        run_search_and_replace: runSearchAndReplace,
    };
    return {
        endpoint: 'PUT /sites/environments/{env_id}/change-primary-domain',
        method: 'PUT',
        path: `/sites/environments/${encodeURIComponent(envId)}/change-primary-domain`,
        body,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /sites/environments/{env_id}/domains',
    'POST /sites/environments/{env_id}/domains',
    'DELETE /sites/environments/{env_id}/domains',
    'GET /sites/environments/domains/{site_domain_id}/verification-records',
    'PUT /sites/environments/{env_id}/change-primary-domain',
];
