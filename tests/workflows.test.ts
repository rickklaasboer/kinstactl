import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import releaseIt, {whatBump} from '../.release-it';
import {artifactName, TARGETS} from '../scripts/build-binaries';

const releaseSource = readFileSync('.github/workflows/release.yml', 'utf8');
const release = parse(releaseSource);
const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));

function runs(job: {steps: {run?: string}[]}): string[] {
    return job.steps.flatMap((step) => (step.run ? [step.run] : []));
}

test('release-it bumps on main and leaves publishing to the workflow', () => {
    expect(releaseIt.git.requireBranch).toBe('main');
    expect(releaseIt.npm.publish).toBe(false);
    expect(releaseIt.github.release).toBe(true);
    // a re-run with increment "none" finds the tag and its release already there
    expect(releaseIt.github.update).toBe(true);
    expect(releaseIt.hooks['before:init']).toEqual([
        'bun run lint',
        'bun test',
        'bun run typecheck',
    ]);
});

test('the release job fast-forwards to the latest main after checkout', () => {
    const steps: {uses?: string; run?: string}[] = release.jobs.release.steps;
    const checkout = steps.findIndex((s) =>
        s.uses?.startsWith('actions/checkout'),
    );
    const pull = steps.findIndex((s) =>
        s.run?.includes('git pull --ff-only origin main'),
    );
    expect(checkout).toBe(0);
    expect(pull).toBeGreaterThan(checkout);
});

test('release-it derives the bump from angular commits', () => {
    expect(
        releaseIt.plugins['@release-it/conventional-changelog'].preset,
    ).toEqual({name: 'angular'});

    const commit = (type: string, breaking = false) => ({
        type,
        notes: breaking ? [{title: 'BREAKING CHANGE'}] : [],
    });
    expect(whatBump([])).toBeNull();
    expect(
        whatBump([commit('docs'), commit('chore'), commit('ci')]),
    ).toBeNull();
    expect(whatBump([commit('docs'), commit('fix')])).toEqual({level: 2});
    expect(whatBump([commit('perf')])).toEqual({level: 2});
    expect(whatBump([commit('fix'), commit('feat'), commit('fix')])).toEqual({
        level: 1,
    });
    expect(whatBump([commit('feat'), commit('chore', true)])).toEqual({
        level: 0,
    });
});

test('a push to main releases from commits and the manual trigger can force a bump', () => {
    expect(release.on.push.branches).toEqual(['main']);
    const input = release.on.workflow_dispatch.inputs.increment;
    expect(input.default).toBe('auto (from commits)');
    expect(input.options).toEqual([
        'auto (from commits)',
        'patch',
        'minor',
        'major',
        'none (release the current package.json version)',
    ]);
    expect(release.concurrency.group).toBe('release');
});

test('the first automatic release is a major bump (0.0.0 to 1.0.0)', () => {
    const run = runs(release.jobs.release).find((r) =>
        r.includes('bunx release-it --ci'),
    );
    expect(run).toContain("git tag --list 'v*'");
    expect(run).toContain('bunx release-it major --ci');
});

test('a run without a new version skips every publish job', () => {
    expect(release.jobs.release.outputs.released).toBe(
        `\${{ steps.version.outputs.released }}`,
    );
    // smoke, publish-binaries and docker hang off binaries, so they skip too
    for (const name of ['binaries', 'npm']) {
        expect(release.jobs[name].if).toBe(
            "needs.release.outputs.released == 'true'",
        );
    }
    expect(release.jobs.smoke.needs).toContain('binaries');
});

test('the job graph publishes nothing before the binaries pass the smoke test', () => {
    expect(Object.keys(release.jobs)).toEqual([
        'release',
        'binaries',
        'smoke',
        'publish-binaries',
        'npm',
        'docker',
    ]);
    expect(release.jobs['publish-binaries'].needs).toContain('smoke');
    expect(release.jobs.docker.needs).toContain('smoke');

    const include = release.jobs.smoke.strategy.matrix.include;
    const known = Object.keys(TARGETS).map(artifactName);
    expect(include.length).toBeGreaterThanOrEqual(4);
    for (const entry of include) {
        expect(known).toContain(entry.artifact);
    }
});

test('binary uploads overwrite on a re-run', () => {
    const upload = runs(release.jobs['publish-binaries']).find((run) =>
        run.includes('gh release upload'),
    );
    expect(upload).toContain('--clobber');
});

test('npm publishes to npmjs.com with provenance', () => {
    const job = release.jobs.npm;
    expect(job.permissions['id-token']).toBe('write');
    expect(
        job.steps.some(
            (step: {with?: Record<string, string>}) =>
                step.with?.['registry-url'] === 'https://registry.npmjs.org',
        ),
    ).toBe(true);
    expect(
        runs(job).some((run) =>
            run.includes('npm publish --provenance --access public'),
        ),
    ).toBe(true);
    expect(releaseSource).not.toContain('npm.pkg.github.com');
});

test('every job after release checks out the released tag', () => {
    for (const [name, job] of Object.entries<{
        steps: {uses?: string; with?: Record<string, string>}[];
    }>(release.jobs)) {
        if (name === 'release') continue;
        for (const step of job.steps) {
            if (step.uses?.startsWith('actions/checkout')) {
                expect(step.with?.ref).toBe(
                    `v\${{ needs.release.outputs.version }}`,
                );
            }
        }
    }
});

test('the npm token is only exposed to the npm job', () => {
    for (const [name, job] of Object.entries(release.jobs)) {
        expect([name, JSON.stringify(job).includes('NPM_TOKEN')]).toEqual([
            name,
            name === 'npm',
        ]);
    }
});

test('ci runs the package smoke', () => {
    expect(runs(ci.jobs.package)).toContain('bun run smoke:package');
});
