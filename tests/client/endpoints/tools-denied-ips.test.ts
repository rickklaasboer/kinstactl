import {describe, expect, test} from 'bun:test';
import {listDeniedIps, setDeniedIps} from '@/client/endpoints/tools';

describe('denied IPs', () => {
    test('listDeniedIps passes the environment as a query', () => {
        expect(listDeniedIps('e1')).toEqual({
            endpoint: 'GET /sites/tools/denied-ips',
            method: 'GET',
            path: '/sites/tools/denied-ips',
            query: {environment_id: 'e1'},
        });
    });

    test('setDeniedIps sends environment_id and ip_list', () => {
        expect(setDeniedIps('e1', ['1.1.1.1', '2.2.2.0/24'])).toEqual({
            endpoint: 'PUT /sites/tools/denied-ips',
            method: 'PUT',
            path: '/sites/tools/denied-ips',
            body: {environment_id: 'e1', ip_list: ['1.1.1.1', '2.2.2.0/24']},
        });
    });
});
