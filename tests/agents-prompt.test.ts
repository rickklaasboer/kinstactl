import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {
    promptBody,
    README_PATH,
    readmeBlock,
    SKILL_PATH,
    syncReadme,
} from '../scripts/agents-prompt';

const skill = readFileSync(SKILL_PATH, 'utf8');

test('the readme carries the skill body verbatim', () => {
    const readme = readFileSync(README_PATH, 'utf8');
    expect(readme).toContain(readmeBlock(promptBody(skill)));
});

test('syncReadme replaces only the block', () => {
    const readme =
        'a\n<!-- agents-prompt:start -->\nold\n<!-- agents-prompt:end -->\nb';
    expect(syncReadme(readme, 'new')).toBe(`a\n${readmeBlock('new')}\nb`);
    expect(() => syncReadme('no markers', 'new')).toThrow(
        'README.md has no agents-prompt markers',
    );
    expect(() => syncReadme('<!-- agents-prompt:start -->', 'new')).toThrow(
        'README.md has no agents-prompt markers',
    );
});

test('promptBody rejects a file without frontmatter', () => {
    expect(() => promptBody('just text')).toThrow(
        'SKILL.md has no frontmatter',
    );
});

test('the skill has the required frontmatter', () => {
    expect(skill.startsWith('---\nname: kinstactl\ndescription: ')).toBe(true);
    const close = skill.indexOf('\n---\n', 4);
    expect(close).toBeGreaterThan(0);
    expect(promptBody(skill).length).toBeGreaterThan(0);
    expect(promptBody(skill)).not.toContain('name: kinstactl');
});

test('the prompt covers every rule from the spec', () => {
    const body = promptBody(skill);
    const required = [
        'npm i -g kinstactl',
        'npx kinstactl',
        'kinstactl --version',
        'KINSTA_API_KEY',
        'KINSTA_COMPANY_ID',
        'kinstactl commands --json',
        '--help',
        '--json --no-input',
        'hints',
        '--dry-run',
        '--yes',
        '--confirm',
        '--no-wait',
        'kinstactl operations wait',
        'https://kinstactl.rickklaasboer.nl/llms.txt',
    ];
    const missing = required.filter((phrase) => !body.includes(phrase));
    expect(missing).toEqual([]);
});

test('the prompt never tells the agent to print the key', () => {
    expect(promptBody(skill)).not.toMatch(/echo \$KINSTA_API_KEY/);
});
