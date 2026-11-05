import {expect, test} from 'bun:test';
import {runCli} from '../../helpers/runCli';

const sitesBody = {
    company: {
        sites: [
            {
                id: 'id-x',
                name: 'klant-x',
                display_name: 'Klant X',
                status: 'live',
                environments: [
                    {id: 'env-x-live', name: 'live', display_name: 'Live'},
                    {
                        id: 'env-x-staging',
                        name: 'staging',
                        display_name: 'Staging',
                    },
                ],
            },
            {
                id: 'id-y',
                name: 'klant-y',
                display_name: 'Klant Y',
                status: 'live',
                environments: [
                    {id: 'env-y-live', name: 'live', display_name: 'Live'},
                ],
            },
        ],
    },
};

const routes = {'GET /sites': {body: sitesBody}};

const noPrompts = {
    search: async () => {
        throw new Error('completion must not prompt');
    },
    select: async () => {
        throw new Error('completion must not prompt');
    },
};

test('completion zsh prints the script', async () => {
    const r = await runCli(['completion', 'zsh']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('compdef _kinstactl kinstactl');
});

test('completion bash and fish print their scripts', async () => {
    const bash = await runCli(['completion', 'bash']);
    expect(bash.stdout).toContain('complete -F _kinstactl kinstactl');
    const fish = await runCli(['completion', 'fish']);
    expect(fish.stdout).toContain('complete -c kinstactl -f');
});

test('completion zsh --json wraps the script', async () => {
    const r = await runCli(['completion', 'zsh', '--json']);
    const json = JSON.parse(r.stdout) as {shell: string; script: string};
    expect(json.shell).toBe('zsh');
    expect(json.script).toContain('_kinstactl');
});

test('completion sites prints cached names without prompting', async () => {
    const r = await runCli(['completion', 'sites'], {
        routes,
        tty: true,
        prompts: noPrompts,
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('klant-x\nklant-y\n');
});

test('completion envs prints the environments of a site', async () => {
    const r = await runCli(['completion', 'envs', 'klant-x'], {
        routes,
        tty: true,
        prompts: noPrompts,
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('live\nstaging\n');
});

test('completion envs with an unknown site exits 2 with empty stdout', async () => {
    const r = await runCli(['completion', 'envs', 'nope'], {
        routes,
        tty: true,
        prompts: noPrompts,
    });
    expect(r.code).toBe(2);
    expect(r.stdout).toBe('');
});
