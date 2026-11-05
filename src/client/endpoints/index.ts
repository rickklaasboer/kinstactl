import {ENDPOINTS as account} from './account.js';
import {ENDPOINTS as analytics} from './analytics.js';
import {ENDPOINTS as backups} from './backups.js';
import {ENDPOINTS as dns} from './dns.js';
import {ENDPOINTS as domains} from './domains.js';
import {ENDPOINTS as environments} from './environments.js';
import {ENDPOINTS as logs} from './logs.js';
import {ENDPOINTS as operations} from './operations.js';
import {ENDPOINTS as plugins} from './plugins.js';
import {ENDPOINTS as security} from './security.js';
import {ENDPOINTS as sftp} from './sftp.js';
import {ENDPOINTS as sites} from './sites.js';
import {ENDPOINTS as ssh} from './ssh.js';
import {ENDPOINTS as tools} from './tools.js';
import {ENDPOINTS as wp} from './wp.js';
import type {EndpointKey} from '../request.js';

export const ALL_ENDPOINTS: EndpointKey[] = [
    ...account,
    ...sites,
    ...environments,
    ...tools,
    ...backups,
    ...logs,
    ...plugins,
    ...operations,
    ...domains,
    ...dns,
    ...wp,
    ...ssh,
    ...sftp,
    ...security,
    ...analytics,
];
