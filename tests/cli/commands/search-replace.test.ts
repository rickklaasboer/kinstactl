import {describe, expect, test} from 'bun:test';
import type {FakeCall} from '../../helpers/fakeKinsta';
import {runCli} from '../../helpers/runCli';

const routes = {
    'GET /sites': {
        body: {
            company: {
                sites: [
                    {
                        id: 'id-x',
                        name: 'klant-x',
                        display_name: 'Klant X',
                        status: 'live',
                        environments: [
                            {
                                id: 'env-live',
                                name: 'live',
                                display_name: 'Live',
                            },
                        ],
                    },
                ],
            },
        },
    },
    'POST /sites/tools/search-and-replace': {
        body: {operation_id: 'op1', message: 'started', status: 202},
    },
    'GET /operations/op1': {
        status: 200,
        body: {message: 'ok', status: 200, data: '3 matches'},
    },
};

const posts = (calls: FakeCall[]) => calls.filter((c) => c.method === 'POST');

describe('search-replace', () => {
    test('without --apply sends perform_replacement false and asks nothing', async () => {
        const r = await runCli(['search-replace', 'klant-x', 'old', 'new'], {
            routes,
        });
        expect(r.code).toBe(0);
        expect(posts(r.calls)[0]!.body).toEqual({
            environment_id: 'env-live',
            search: 'old',
            replace: 'new',
            perform_replacement: false,
            is_clear_cache: false,
        });
        expect(r.stdout).toContain('3 matches');
    });

    test('--apply without --yes exits 5 and sends nothing', async () => {
        const r = await runCli(
            ['search-replace', 'klant-x', 'old', 'new', '--apply'],
            {routes},
        );
        expect(r.code).toBe(5);
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('--apply --dry-run sends nothing regardless of --yes', async () => {
        const r = await runCli(
            [
                'search-replace',
                'klant-x',
                'old',
                'new',
                '--apply',
                '--yes',
                '--dry-run',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)).toHaveLength(0);
    });

    test('--apply --yes --clear-cache sends the body', async () => {
        const r = await runCli(
            [
                'search-replace',
                'klant-x',
                'old',
                'new',
                '--apply',
                '--yes',
                '--clear-cache',
            ],
            {routes},
        );
        expect(r.code).toBe(0);
        expect(posts(r.calls)[0]!.body).toEqual({
            environment_id: 'env-live',
            search: 'old',
            replace: 'new',
            perform_replacement: true,
            is_clear_cache: true,
        });
    });
});
