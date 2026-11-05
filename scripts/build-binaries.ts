import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const TARGETS: Record<string, string> = {
    'darwin-arm64': 'bun-darwin-arm64',
    'darwin-x64': 'bun-darwin-x64',
    'linux-x64': 'bun-linux-x64',
    'linux-arm64': 'bun-linux-arm64',
    'windows-x64': 'bun-windows-x64',
};

export function artifactName(target: string): string {
    return `kinstactl-${target}${target.startsWith('windows-') ? '.exe' : ''}`;
}

export function checksumLine(hex: string, file: string): string {
    return `${hex}  ${file}`;
}

export function buildBinaries(targets: string[], outDir = 'dist/bin'): void {
    const unknown = targets.filter((target) => !(target in TARGETS));
    if (unknown.length > 0) {
        throw new Error(
            `Unknown target(s): ${unknown.join(', ')}. Valid targets: ${Object.keys(TARGETS).join(', ')}`,
        );
    }

    mkdirSync(outDir, {recursive: true});

    const files: string[] = [];
    for (const target of targets) {
        const file = artifactName(target);
        // A cwd bunfig.toml would otherwise be read at runtime and can break the binary
        const result = spawnSync(
            'bun',
            [
                'build',
                'src/cli/main.ts',
                '--compile',
                '--no-compile-autoload-bunfig',
                `--target=${TARGETS[target]}`,
                '--outfile',
                join(outDir, file),
            ],
            {encoding: 'utf8'},
        );
        if (result.error) {
            throw new Error(
                `Building ${target} failed to start: ${result.error.message}`,
            );
        }
        if (result.status !== 0) {
            throw new Error(
                `Building ${target} failed with exit code ${result.status}:\n${result.stderr}`,
            );
        }
        files.push(file);
    }

    const lines = files.sort().map((file) =>
        checksumLine(
            createHash('sha256')
                .update(readFileSync(join(outDir, file)))
                .digest('hex'),
            file,
        ),
    );
    writeFileSync(join(outDir, 'SHA256SUMS'), `${lines.join('\n')}\n`);
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    buildBinaries(args.length > 0 ? args : Object.keys(TARGETS));
}
