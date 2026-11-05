import type {components} from '@/client/generated/openapi';
import type {EndpointKey, RequestSpec} from '@/client/request';

type Schemas = components['schemas'];

export type ForceHttpsMode = Schemas['SetForceHttpsStatus-Body']['type'];
export type BotProtectionLevel = Schemas['SetBotProtectionLevel-Body']['level'];
export type ToggleStatus = Schemas['SetBlockAiCrawlersRequestBody']['status'];
export type ExceptionRuleType =
    Schemas['AddBotProtectionExceptionRule-Body']['type'];
export type ExceptionRuleAction =
    Schemas['AddBotProtectionExceptionRule-Body']['action'];

const envPath = (envId: string) =>
    `/sites/environments/${encodeURIComponent(envId)}`;

export function getForceHttps(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/force-https-status',
        method: 'GET',
        path: `${envPath(envId)}/force-https-status`,
    };
}

export function setForceHttps(
    envId: string,
    mode: ForceHttpsMode,
): RequestSpec {
    const body: Schemas['SetForceHttpsStatus-Body'] = {type: mode};
    return {
        endpoint: 'POST /sites/environments/{env_id}/force-https-status',
        method: 'POST',
        path: `${envPath(envId)}/force-https-status`,
        body,
    };
}

export function getBotProtectionLevel(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/bot-protection/level',
        method: 'GET',
        path: `${envPath(envId)}/bot-protection/level`,
    };
}

export function setBotProtectionLevel(
    envId: string,
    level: BotProtectionLevel,
): RequestSpec {
    const body: Schemas['SetBotProtectionLevel-Body'] = {level};
    return {
        endpoint: 'PUT /sites/environments/{env_id}/bot-protection/level',
        method: 'PUT',
        path: `${envPath(envId)}/bot-protection/level`,
        body,
    };
}

export function getAiCrawlerBlocking(envId: string): RequestSpec {
    return {
        endpoint: 'GET /sites/environments/{env_id}/bot-protection/ai-crawlers',
        method: 'GET',
        path: `${envPath(envId)}/bot-protection/ai-crawlers`,
    };
}

export function setAiCrawlerBlocking(
    envId: string,
    status: ToggleStatus,
): RequestSpec {
    const body: Schemas['SetBlockAiCrawlersRequestBody'] = {status};
    return {
        endpoint: 'PUT /sites/environments/{env_id}/bot-protection/ai-crawlers',
        method: 'PUT',
        path: `${envPath(envId)}/bot-protection/ai-crawlers`,
        body,
    };
}

export function getWpAutomations(envId: string): RequestSpec {
    return {
        endpoint:
            'GET /sites/environments/{env_id}/bot-protection/wp-automations',
        method: 'GET',
        path: `${envPath(envId)}/bot-protection/wp-automations`,
    };
}

export function setWpAutomations(
    envId: string,
    status: ToggleStatus,
): RequestSpec {
    const body: Schemas['SetAllowWpAutomationsStatusRequestBody'] = {status};
    return {
        endpoint:
            'PUT /sites/environments/{env_id}/bot-protection/wp-automations',
        method: 'PUT',
        path: `${envPath(envId)}/bot-protection/wp-automations`,
        body,
    };
}

export function listExceptionRules(envId: string): RequestSpec {
    return {
        endpoint:
            'GET /sites/environments/{env_id}/bot-protection/exception-rules',
        method: 'GET',
        path: `${envPath(envId)}/bot-protection/exception-rules`,
    };
}

export function addExceptionRule(
    envId: string,
    rule: {
        type: ExceptionRuleType;
        action: ExceptionRuleAction;
        value: string;
    },
): RequestSpec {
    const body: Schemas['AddBotProtectionExceptionRule-Body'] = {
        type: rule.type,
        action: rule.action,
        value: rule.value,
    };
    return {
        endpoint:
            'POST /sites/environments/{env_id}/bot-protection/exception-rules',
        method: 'POST',
        path: `${envPath(envId)}/bot-protection/exception-rules`,
        body,
    };
}

export function removeExceptionRule(
    envId: string,
    ruleId: string,
): RequestSpec {
    const body: Schemas['RemoveBotProtectionExceptionRule-Body'] = {
        exception_rule_id: ruleId,
    };
    return {
        endpoint:
            'DELETE /sites/environments/{env_id}/bot-protection/exception-rules',
        method: 'DELETE',
        path: `${envPath(envId)}/bot-protection/exception-rules`,
        body,
    };
}

export const ENDPOINTS: EndpointKey[] = [
    'GET /sites/environments/{env_id}/force-https-status',
    'POST /sites/environments/{env_id}/force-https-status',
    'GET /sites/environments/{env_id}/bot-protection/level',
    'PUT /sites/environments/{env_id}/bot-protection/level',
    'GET /sites/environments/{env_id}/bot-protection/ai-crawlers',
    'PUT /sites/environments/{env_id}/bot-protection/ai-crawlers',
    'GET /sites/environments/{env_id}/bot-protection/wp-automations',
    'PUT /sites/environments/{env_id}/bot-protection/wp-automations',
    'GET /sites/environments/{env_id}/bot-protection/exception-rules',
    'POST /sites/environments/{env_id}/bot-protection/exception-rules',
    'DELETE /sites/environments/{env_id}/bot-protection/exception-rules',
];
