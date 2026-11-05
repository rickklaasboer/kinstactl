import {injectable} from 'tsyringe';
import {
    getAiCrawlerBlocking,
    setAiCrawlerBlocking,
    type ToggleStatus,
} from '@/client/endpoints/security';
import type {components} from '@/client/generated/openapi';
import {
    type BotProtectionSetting,
    BotProtectionSettingCommand,
} from './BotProtectionSettingCommand';

type CrawlersResponse = {
    bot_protection: components['schemas']['BlockAiCrawlersStatusSchema'] | null;
};

@injectable()
export class SecurityBotProtectionAiCrawlersCommand extends BotProtectionSettingCommand {
    protected readonly setting: BotProtectionSetting = {
        name: 'ai-crawlers',
        description: 'Show or set whether AI crawlers are blocked',
        get: getAiCrawlerBlocking,
        set: (envId, status) =>
            setAiCrawlerBlocking(envId, status as ToggleStatus),
        endpoints: [
            'GET /sites/environments/{env_id}/bot-protection/ai-crawlers',
            'PUT /sites/environments/{env_id}/bot-protection/ai-crawlers',
        ],
        choices: ['block', 'allow'],
        read: (body) => {
            const rule = (body as CrawlersResponse).bot_protection;
            if (rule === null) return null;
            return rule.ai_crawlers_blocking === 'enabled' ? 'block' : 'allow';
        },
        toApi: (choice) => (choice === 'block' ? 'enabled' : 'disabled'),
    };
}
