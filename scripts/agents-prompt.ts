import {readFileSync, writeFileSync} from 'node:fs';

export const SKILL_PATH = 'skills/kinstactl/SKILL.md';
export const README_PATH = 'README.md';
export const START = '<!-- agents-prompt:start -->';
export const END = '<!-- agents-prompt:end -->';

/** The text after the frontmatter of SKILL.md, trimmed. */
export function promptBody(skill: string): string {
    const match = /^---\n[\s\S]*?\n---\n/.exec(skill);
    if (!match) throw new Error('SKILL.md has no frontmatter');
    return skill.slice(match[0].length).trim();
}

export function readmeBlock(prompt: string): string {
    return `${START}\n\`\`\`text\n${prompt}\n\`\`\`\n${END}`;
}

export function syncReadme(readme: string, prompt: string): string {
    const start = readme.indexOf(START);
    const end = readme.indexOf(END);
    if (start === -1 || end === -1 || end < start) {
        throw new Error('README.md has no agents-prompt markers');
    }
    return (
        readme.slice(0, start) +
        readmeBlock(prompt) +
        readme.slice(end + END.length)
    );
}

if (import.meta.main) {
    const prompt = promptBody(readFileSync(SKILL_PATH, 'utf8'));
    const readme = readFileSync(README_PATH, 'utf8');
    const next = syncReadme(readme, prompt);
    if (next === readme) {
        console.log('README.md unchanged');
    } else {
        writeFileSync(README_PATH, next);
        console.log('README.md updated');
    }
}
