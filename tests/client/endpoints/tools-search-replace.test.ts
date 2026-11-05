import {describe, expect, test} from 'bun:test';
import {searchAndReplace, WP_COMMAND_PATTERN} from '@/client/endpoints/tools';

describe('searchAndReplace', () => {
    test('maps the options to the spec fields', () => {
        expect(
            searchAndReplace('e1', {
                search: 'old',
                replace: 'new',
                apply: true,
                clearCache: false,
            }),
        ).toEqual({
            endpoint: 'POST /sites/tools/search-and-replace',
            method: 'POST',
            path: '/sites/tools/search-and-replace',
            body: {
                environment_id: 'e1',
                search: 'old',
                replace: 'new',
                perform_replacement: true,
                is_clear_cache: false,
            },
        });
    });
});

describe('WP_COMMAND_PATTERN', () => {
    test('accepts wp commands and rejects the rest', () => {
        expect(WP_COMMAND_PATTERN.test("wp option get 'blogname'")).toBe(true);
        expect(WP_COMMAND_PATTERN.test('plugin list')).toBe(false);
        expect(WP_COMMAND_PATTERN.test('wp plugin list; rm -rf /')).toBe(false);
    });
});
