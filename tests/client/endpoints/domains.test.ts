import {expect, test} from 'bun:test';
import * as domains from '@/client/endpoints/domains';

test('listSiteDomains', () => {
    expect(domains.listSiteDomains('e 1')).toEqual({
        endpoint: 'GET /sites/environments/{env_id}/domains',
        method: 'GET',
        path: '/sites/environments/e%201/domains',
    });
});

test('addSiteDomain sends only the given options', () => {
    const spec = domains.addSiteDomain('e1', {domainName: 'x.nl'});
    expect(spec.endpoint).toBe('POST /sites/environments/{env_id}/domains');
    expect(spec.path).toBe('/sites/environments/e1/domains');
    expect(spec.body).toEqual({domain_name: 'x.nl'});
});

test('addSiteDomain maps every option onto its body field', () => {
    expect(
        domains.addSiteDomain('e1', {
            domainName: 'x.nl',
            wildcard: true,
            withWww: false,
            setupType: 'avoid_downtime',
            customSslKey: 'KEY',
            customSslCert: 'CERT',
        }).body,
    ).toEqual({
        domain_name: 'x.nl',
        is_wildcardless: false,
        add_with_www_subdomain: false,
        setup_type: 'avoid_downtime',
        custom_ssl_key: 'KEY',
        custom_ssl_cert: 'CERT',
    });
});

test('deleteSiteDomains is a DELETE with a body', () => {
    expect(domains.deleteSiteDomains('e1', ['d1', 'd2'])).toEqual({
        endpoint: 'DELETE /sites/environments/{env_id}/domains',
        method: 'DELETE',
        path: '/sites/environments/e1/domains',
        body: {domain_ids: ['d1', 'd2']},
    });
});

test('getVerificationRecords', () => {
    expect(domains.getVerificationRecords('d 1')).toEqual({
        endpoint:
            'GET /sites/environments/domains/{site_domain_id}/verification-records',
        method: 'GET',
        path: '/sites/environments/domains/d%201/verification-records',
    });
});

test('changePrimaryDomain', () => {
    expect(domains.changePrimaryDomain('e1', 'd1', true)).toEqual({
        endpoint: 'PUT /sites/environments/{env_id}/change-primary-domain',
        method: 'PUT',
        path: '/sites/environments/e1/change-primary-domain',
        body: {domain_id: 'd1', run_search_and_replace: true},
    });
});
