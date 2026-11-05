import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {artifactName, TARGETS} from '../scripts/build-binaries';

const releaseSource = readFileSync('.github/workflows/release.yml', 'utf8');
const release = parse(releaseSource);
const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
const releaseIt = JSON.parse(readFileSync('.release-it.json', 'utf8'));

function runs(job: {steps: {run?: string}[]}): string[] {
    return job.steps.flatMap((step) => (step.run ? [step.run] : []));
}

test('release-it bumps on main and leaves publishing to the workflow', () => {
    expect(releaseIt.git.requireBranch).toBe('main');
    expect(releaseIt.npm.publish).toBe(false);
    expect(releaseIt.github.release).toBe(true);
    expect(releaseIt.hooks['before:init']).toEqual([
        'bun run lint',
        'bun test',
        'bun run typecheck',
    ]);
});

test('a push to main releases a patch and the manual trigger offers the four increments', () => {
    expect(release.on.push.branches).toEqual(['main']);
    const options = release.on.workflow_dispatch.inputs.increment.options;
    expect(options).toHaveLength(4);
    expect(options).toContain(
        'none (release the current package.json version)',
    );
    expect(release.concurrency.group).toBe('release');
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
