// biome-ignore-all lint/suspicious/noTemplateCurlyInString: release-it fills in ${version}

// Semantic versioning from Angular commits: a BREAKING CHANGE footer bumps
// major, feat bumps minor, fix and perf bump patch. Anything else (docs, chore,
// ci, test, refactor, style, build) does not release at all, unlike the
// angular preset's own whatBump, which falls back to a patch.
type Commit = {type?: string | null; notes: {title: string}[]};

export const whatBump = (commits: Commit[]): {level: 0 | 1 | 2} | null => {
    let level: 0 | 1 | 2 | null = null;
    for (const commit of commits) {
        if (commit.notes.some((note) => note.title === 'BREAKING CHANGE')) {
            return {level: 0};
        }
        if (commit.type === 'feat') {
            level = 1;
        } else if (
            (commit.type === 'fix' || commit.type === 'perf') &&
            level === null
        ) {
            level = 2;
        }
    }
    return level === null ? null : {level};
};

export default {
    git: {
        commitMessage: 'chore: release v${version} [skip ci]',
        tagName: 'v${version}',
        requireCleanWorkingDir: true,
        requireBranch: 'main',
    },
    github: {
        release: true,
        update: true,
        releaseName: 'v${version}',
    },
    npm: {
        publish: false,
    },
    plugins: {
        '@release-it/conventional-changelog': {
            preset: {name: 'angular'},
            whatBump,
        },
    },
    hooks: {
        'before:init': ['bun run lint', 'bun test', 'bun run typecheck'],
    },
};
