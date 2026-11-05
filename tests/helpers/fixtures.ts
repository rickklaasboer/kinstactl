import type {ApiEnvironment} from '@/cli/services/SiteResolver';
import type {FakeRoute} from './fakeKinsta';

/** 'GET /sites' body: my-site (id-x) with a live and a staging environment. */
export const SITES: FakeRoute = {
    body: {
        company: {
            sites: [
                {
                    id: 'id-x',
                    name: 'my-site',
                    display_name: 'My Site',
                    status: 'live',
                    environments: [
                        {
                            id: 'env-live',
                            name: 'live',
                            display_name: 'Live',
                        },
                        {
                            id: 'env-stg',
                            name: 'staging',
                            display_name: 'Staging',
                        },
                    ],
                },
            ],
        },
    },
};

export const SITES_ROUTES = {'GET /sites': SITES};

export function environmentsRoute(
    envs: Partial<ApiEnvironment>[],
): Record<string, FakeRoute> {
    return {
        'GET /sites/id-x/environments': {body: {site: {environments: envs}}},
    };
}

export const started = (id: string) => ({
    body: {operation_id: id, message: 'started'},
});

export const done = (id: string) => ({
    [`GET /operations/${id}`]: {
        status: 200,
        body: {message: 'ok', status: 200},
    },
});
