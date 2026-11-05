import {describe, expect, test} from 'bun:test';
import * as dns from '@/client/endpoints/dns';

describe('dns', () => {
    test('listDomains', () => {
        expect(dns.listDomains('c1')).toEqual({
            endpoint: 'GET /domains',
            method: 'GET',
            path: '/domains',
            query: {company: 'c1'},
        });
    });
    test('listDnsRecords', () => {
        expect(dns.listDnsRecords('z 1')).toEqual({
            endpoint: 'GET /domains/{domain_id}/dns-records',
            method: 'GET',
            path: '/domains/z%201/dns-records',
        });
    });
    test('createDnsRecord maps values to resource_records', () => {
        expect(
            dns.createDnsRecord('z1', {
                type: 'A',
                name: 'www',
                ttl: 300,
                values: ['1.2.3.4', '5.6.7.8'],
            }),
        ).toEqual({
            endpoint: 'POST /domains/{domain_id}/dns-records',
            method: 'POST',
            path: '/domains/z1/dns-records',
            body: {
                type: 'A',
                name: 'www',
                ttl: 300,
                resource_records: [{value: '1.2.3.4'}, {value: '5.6.7.8'}],
            },
        });
    });
    test('createDnsRecord rejects a ttl below 300', () => {
        expect(() =>
            dns.createDnsRecord('z1', {
                type: 'A',
                name: 'www',
                ttl: 60,
                values: ['1.2.3.4'],
            }),
        ).toThrow(RangeError);
    });
    test('updateDnsRecord sends only the given changes', () => {
        expect(
            dns.updateDnsRecord('z1', {type: 'A', name: 'www', ttl: 600}),
        ).toEqual({
            endpoint: 'PUT /domains/{domain_id}/dns-records',
            method: 'PUT',
            path: '/domains/z1/dns-records',
            body: {type: 'A', name: 'www', ttl: 600},
        });
        expect(
            dns.updateDnsRecord('z1', {
                type: 'A',
                name: 'www',
                add: ['1.1.1.1'],
                remove: ['2.2.2.2'],
            }).body,
        ).toEqual({
            type: 'A',
            name: 'www',
            new_resource_records: [{value: '1.1.1.1'}],
            removed_resource_records: [{value: '2.2.2.2'}],
        });
        expect(() =>
            dns.updateDnsRecord('z1', {type: 'A', name: 'www', ttl: 299}),
        ).toThrow(RangeError);
    });
    test('deleteDnsRecord sends type and name as body', () => {
        expect(dns.deleteDnsRecord('z1', 'A', 'www')).toEqual({
            endpoint: 'DELETE /domains/{domain_id}/dns-records',
            method: 'DELETE',
            path: '/domains/z1/dns-records',
            body: {type: 'A', name: 'www'},
        });
    });
});
