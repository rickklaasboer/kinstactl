import type {components} from '../generated/openapi';
import type {EndpointKey, RequestSpec} from '../request';

type Schemas = components['schemas'];

const MIN_TTL = 300;

export interface DnsRecordInput {
    type: string;
    name: string;
    ttl: number;
    values: string[];
}

export interface DnsRecordChange {
    type: string;
    name: string;
    ttl?: number;
    add?: string[];
    remove?: string[];
}

function assertTtl(ttl: number): void {
    if (ttl < MIN_TTL)
        throw new RangeError(`ttl must be at least ${MIN_TTL} seconds`);
}

const dnsRecordsPath = (domainId: string) =>
    `/domains/${encodeURIComponent(domainId)}/dns-records`;

export function listDomains(companyId: string): RequestSpec {
    return {
        endpoint: 'GET /domains',
        method: 'GET',
        path: '/domains',
        query: {company: companyId},
    };
}

export function listDnsRecords(domainId: string): RequestSpec {
    return {
        endpoint: 'GET /domains/{domain_id}/dns-records',
        method: 'GET',
        path: dnsRecordsPath(domainId),
    };
}

export function createDnsRecord(
    domainId: string,
    record: DnsRecordInput,
): RequestSpec {
    assertTtl(record.ttl);
    const body: Schemas['DomainDnsRecord'] = {
        type: record.type,
        name: record.name,
        ttl: record.ttl,
        resource_records: record.values.map((value) => ({value})),
    };
    return {
        endpoint: 'POST /domains/{domain_id}/dns-records',
        method: 'POST',
        path: dnsRecordsPath(domainId),
        body,
    };
}

export function updateDnsRecord(
    domainId: string,
    change: DnsRecordChange,
): RequestSpec {
    if (change.ttl !== undefined) assertTtl(change.ttl);
    const body: Schemas['UpdateDomainDnsRecordRequestBodySchema'] = {
        type: change.type,
        name: change.name,
    };
    if (change.ttl !== undefined) body.ttl = change.ttl;
    if (change.add !== undefined)
        body.new_resource_records = change.add.map((value) => ({value}));
    if (change.remove !== undefined)
        body.removed_resource_records = change.remove.map((value) => ({
            value,
        }));
    return {
        endpoint: 'PUT /domains/{domain_id}/dns-records',
        method: 'PUT',
        path: dnsRecordsPath(domainId),
        body,
    };
}

export function deleteDnsRecord(
    domainId: string,
    type: string,
    name: string,
): RequestSpec {
    const body: Schemas['DeleteDomainDnsRecordRequestBodyTransformerSchema'] = {
        type,
        name,
    };
    return {
        endpoint: 'DELETE /domains/{domain_id}/dns-records',
        method: 'DELETE',
        path: dnsRecordsPath(domainId),
        body,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /domains',
    'GET /domains/{domain_id}/dns-records',
    'POST /domains/{domain_id}/dns-records',
    'PUT /domains/{domain_id}/dns-records',
    'DELETE /domains/{domain_id}/dns-records',
];
