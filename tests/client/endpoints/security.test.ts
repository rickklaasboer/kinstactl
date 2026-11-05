import {describe, expect, test} from 'bun:test';
import * as security from '@/client/endpoints/security';

const enc = '/sites/environments/e%201';

describe('security', () => {
    test('getForceHttps', () => {
        expect(security.getForceHttps('e 1')).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/force-https-status',
            method: 'GET',
            path: `${enc}/force-https-status`,
        });
    });
    test('setForceHttps sends type', () => {
        expect(security.setForceHttps('e 1', 'DISABLED')).toEqual({
            endpoint: 'POST /sites/environments/{env_id}/force-https-status',
            method: 'POST',
            path: `${enc}/force-https-status`,
            body: {type: 'DISABLED'},
        });
    });
    test('getBotProtectionLevel', () => {
        expect(security.getBotProtectionLevel('e 1')).toEqual({
            endpoint: 'GET /sites/environments/{env_id}/bot-protection/level',
            method: 'GET',
            path: `${enc}/bot-protection/level`,
        });
    });
    test('setBotProtectionLevel sends level', () => {
        expect(security.setBotProtectionLevel('e 1', 'challenge-bots')).toEqual(
            {
                endpoint:
                    'PUT /sites/environments/{env_id}/bot-protection/level',
                method: 'PUT',
                path: `${enc}/bot-protection/level`,
                body: {level: 'challenge-bots'},
            },
        );
    });
    test('getAiCrawlerBlocking', () => {
        expect(security.getAiCrawlerBlocking('e 1')).toEqual({
            endpoint:
                'GET /sites/environments/{env_id}/bot-protection/ai-crawlers',
            method: 'GET',
            path: `${enc}/bot-protection/ai-crawlers`,
        });
    });
    test('setAiCrawlerBlocking sends status', () => {
        expect(security.setAiCrawlerBlocking('e 1', 'enabled')).toEqual({
            endpoint:
                'PUT /sites/environments/{env_id}/bot-protection/ai-crawlers',
            method: 'PUT',
            path: `${enc}/bot-protection/ai-crawlers`,
            body: {status: 'enabled'},
        });
    });
    test('getWpAutomations', () => {
        expect(security.getWpAutomations('e 1')).toEqual({
            endpoint:
                'GET /sites/environments/{env_id}/bot-protection/wp-automations',
            method: 'GET',
            path: `${enc}/bot-protection/wp-automations`,
        });
    });
    test('setWpAutomations sends status', () => {
        expect(security.setWpAutomations('e 1', 'disabled')).toEqual({
            endpoint:
                'PUT /sites/environments/{env_id}/bot-protection/wp-automations',
            method: 'PUT',
            path: `${enc}/bot-protection/wp-automations`,
            body: {status: 'disabled'},
        });
    });
    test('listExceptionRules', () => {
        expect(security.listExceptionRules('e 1')).toEqual({
            endpoint:
                'GET /sites/environments/{env_id}/bot-protection/exception-rules',
            method: 'GET',
            path: `${enc}/bot-protection/exception-rules`,
        });
    });
    test('addExceptionRule sends type, action and value', () => {
        expect(
            security.addExceptionRule('e 1', {
                type: 'ip',
                action: 'skip',
                value: '192.0.2.1',
            }),
        ).toEqual({
            endpoint:
                'POST /sites/environments/{env_id}/bot-protection/exception-rules',
            method: 'POST',
            path: `${enc}/bot-protection/exception-rules`,
            body: {type: 'ip', action: 'skip', value: '192.0.2.1'},
        });
    });
    test('removeExceptionRule sends exception_rule_id in the body', () => {
        expect(
            security.removeExceptionRule('e 1', 'ip:skip:192.0.2.1'),
        ).toEqual({
            endpoint:
                'DELETE /sites/environments/{env_id}/bot-protection/exception-rules',
            method: 'DELETE',
            path: `${enc}/bot-protection/exception-rules`,
            body: {exception_rule_id: 'ip:skip:192.0.2.1'},
        });
    });
    test('ENDPOINTS lists the 11 builders', () => {
        expect(security.ENDPOINTS).toHaveLength(11);
    });
});
