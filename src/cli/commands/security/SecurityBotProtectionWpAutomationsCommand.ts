import {injectable} from 'tsyringe';
import {
    getWpAutomations,
    setWpAutomations,
    type ToggleStatus,
} from '@/client/endpoints/security';
import type {components} from '@/client/generated/openapi';
import {
    type BotProtectionSetting,
    BotProtectionSettingCommand,
} from './BotProtectionSettingCommand';

type AutomationsResponse = {
    bot_protection:
        | components['schemas']['AllowWpAutomationsStatusSchema']
        | null;
};

@injectable()
export class SecurityBotProtectionWpAutomationsCommand extends BotProtectionSettingCommand {
    protected readonly setting: BotProtectionSetting = {
        name: 'wp-automations',
        description: 'Show or set whether WordPress automations are allowed',
        get: getWpAutomations,
        set: (envId, status) => setWpAutomations(envId, status as ToggleStatus),
        endpoints: [
            'GET /sites/environments/{env_id}/bot-protection/wp-automations',
            'PUT /sites/environments/{env_id}/bot-protection/wp-automations',
        ],
        choices: ['allow', 'block'],
        read: (body) => {
            const rule = (body as AutomationsResponse).bot_protection;
            if (rule === null) return null;
            return rule.wp_automations === 'enabled' ? 'allow' : 'block';
        },
        toApi: (choice) => (choice === 'allow' ? 'enabled' : 'disabled'),
    };
}
