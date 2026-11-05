import {ENDPOINTS as account} from './account';
import {ENDPOINTS as backups} from './backups';
import {ENDPOINTS as environments} from './environments';
import {ENDPOINTS as logs} from './logs';
import {ENDPOINTS as operations} from './operations';
import {ENDPOINTS as plugins} from './plugins';
import {ENDPOINTS as sites} from './sites';
import {ENDPOINTS as tools} from './tools';
import type {EndpointKey} from '@/client/request';

export const ALL_ENDPOINTS: EndpointKey[] = [
    ...account,
    ...sites,
    ...environments,
    ...tools,
    ...backups,
    ...logs,
    ...plugins,
    ...operations,
];
