import {injectable} from 'tsyringe';
import {
    type BotProtectionLevel,
    getBotProtectionLevel,
    setBotProtectionLevel,
} from '@/client/endpoints/security';
import type {components} from '@/client/generated/openapi';
import {
    type BotProtectionSetting,
    BotProtectionSettingCommand,
} from './BotProtectionSettingCommand';

type LevelResponse = {
    bot_protection: components['schemas']['BotProtectionLevelSchema'] | null;
};

@injectable()
export class SecurityBotProtectionLevelCommand extends BotProtectionSettingCommand {
    protected readonly setting: BotProtectionSetting = {
        name: 'level',
        description: 'Show or set the bot protection level of an environment',
        get: getBotProtectionLevel,
        set: (envId, level) =>
            setBotProtectionLevel(envId, level as BotProtectionLevel),
        endpoints: [
            'GET /sites/environments/{env_id}/bot-protection/level',
            'PUT /sites/environments/{env_id}/bot-protection/level',
        ],
        choices: [
            'block-malicious-traffic',
            'block-automations',
            'challenge-bots',
            'challenge-everyone',
        ],
        read: (body) => (body as LevelResponse).bot_protection?.level ?? null,
        toApi: (choice) => choice,
    };
}
