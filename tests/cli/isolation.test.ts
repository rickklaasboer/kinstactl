import {expect, test} from 'bun:test';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {InjectionToken} from 'tsyringe';
import {createContainer} from '@/cli/container';
import type {Io} from '@/cli/io';
import {Output} from '@/cli/output';
import type {Prompts} from '@/cli/prompts';
import {ClientProvider} from '@/cli/services/ClientProvider';
import {BackupService} from '@/cli/commands/backups/BackupService';
import {CompanyUserService} from '@/cli/commands/company/CompanyUserService';
import {DnsZoneService} from '@/cli/commands/dns/DnsZoneService';
import {DomainService} from '@/cli/commands/domains/DomainService';
import {WpItemService} from '@/cli/commands/plugins/WpItemService';
import {RedirectRuleService} from '@/cli/commands/security/RedirectRuleService';
import {ConfigService} from '@/cli/services/ConfigService';
import {ConfirmService} from '@/cli/services/ConfirmService';
import {OperationRunner} from '@/cli/services/OperationRunner';
import {RunContext} from '@/cli/services/RunContext';
import {SecretInput} from '@/cli/services/SecretInput';
import {SiteCache} from '@/cli/services/SiteCache';
import {SiteResolver} from '@/cli/services/SiteResolver';
import {runCli} from '../helpers/runCli';

const sites = {
    'GET /sites': {body: {company: {sites: []}}},
};

function io(): Io {
    return {
        stdout() {},
        stderr() {},
        isTTY: false,
        env: {},
        progressOutput: process.stderr,
        prompts: {} as Prompts,
    };
}

test('a --json run does not make the next run json', async () => {
    const first = await runCli(['auth', 'profiles', '--json']);
    expect(first.code).toBe(0);
    const second = await runCli(['auth', 'profiles']);
    expect(second.stdout).toContain('PROFILE');
});

test('credentials do not leak between runs', async () => {
    const first = await runCli(['sites', 'list', '--refresh'], {
        routes: sites,
        env: {KINSTA_COMPANY_ID: 'c1'},
    });
    expect(first.calls[0]?.url.searchParams.get('company')).toBe('c1');
    const second = await runCli(['sites', 'list', '--refresh'], {
        routes: sites,
        env: {KINSTA_COMPANY_ID: 'c2'},
    });
    expect(second.calls[0]?.url.searchParams.get('company')).toBe('c2');
});

test('services are shared within a run and fresh per run', () => {
    const a = createContainer(io());
    const b = createContainer(io());
    const tokens: InjectionToken<object>[] = [
        RunContext,
        Output,
        ClientProvider,
    ];
    for (const token of tokens) {
        expect(a.resolve(token)).toBe(a.resolve(token));
        expect(a.resolve(token)).not.toBe(b.resolve(token));
    }
});

test('every scoped service is run-scoped', () => {
    const SCOPED: InjectionToken<object>[] = [
        RunContext,
        ConfigService,
        ClientProvider,
        SiteCache,
        SiteResolver,
        ConfirmService,
        OperationRunner,
        SecretInput,
        WpItemService,
        BackupService,
        DomainService,
        DnsZoneService,
        CompanyUserService,
        RedirectRuleService,
    ];
    const a = createContainer(io());
    const b = createContainer(io());
    for (const token of SCOPED) {
        expect(a.resolve(token)).toBe(a.resolve(token));
        expect(a.resolve(token)).not.toBe(b.resolve(token));
    }
    const files = readdirSync('src/cli', {
        recursive: true,
        encoding: 'utf8',
    }).filter(
        (f) =>
            f.endsWith('.ts') &&
            readFileSync(join('src/cli', f), 'utf8').includes('@scoped('),
    );
    expect(SCOPED.length).toBe(files.length);
});

test('src/client uses no path aliases', () => {
    const files = readdirSync('src/client', {
        recursive: true,
        encoding: 'utf8',
    }).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.filter((f) =>
        /from '@\//.test(readFileSync(join('src/client', f), 'utf8')),
    );
    expect(hits).toEqual([]);
});

function extensionlessRelativeImports(source: string): string[] {
    return [...source.matchAll(/(?:from\s+|import\(\s*)'(\.{1,2}\/[^']*)'/g)]
        .map((m) => m[1] as string)
        .filter((specifier) => !specifier.endsWith('.js'));
}

test('the relative import matcher flags extensionless specifiers', () => {
    const source = [
        "import {a} from './a';",
        "export * as b from '../b';",
        "const c = await import('./c');",
        "import {d} from './d.js';",
        "import {e} from 'node:fs';",
    ].join('\n');
    expect(extensionlessRelativeImports(source)).toEqual([
        './a',
        '../b',
        './c',
    ]);
});

test('src/client and src/index.ts use .js extensions on relative imports', () => {
    const files = [
        'src/index.ts',
        ...readdirSync('src/client', {recursive: true, encoding: 'utf8'})
            .filter((f) => f.endsWith('.ts') && !f.startsWith('generated'))
            .map((f) => join('src/client', f)),
    ];
    expect(files.length).toBeGreaterThan(1);
    const hits = files.flatMap((f) =>
        extensionlessRelativeImports(readFileSync(f, 'utf8')).map(
            (specifier) => `${f}: ${specifier}`,
        ),
    );
    expect(hits).toEqual([]);
});

test('src/cli uses no @singleton', () => {
    const files = readdirSync('src/cli', {
        recursive: true,
        encoding: 'utf8',
    }).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
        expect(readFileSync(join('src/cli', f), 'utf8')).not.toContain(
            '@singleton(',
        );
    }
});
