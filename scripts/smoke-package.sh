#!/usr/bin/env bash
# Packs kinstactl, installs the tarball into a scratch project with npm and
# exercises the CLI and the library with node (never bun).
set -euo pipefail

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO"

TMP=$(mktemp -d "${TMPDIR:-/tmp}/kinstactl-smoke.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

echo "check: npm pack"
npm pack --pack-destination "$TMP"
TARBALLS=("$TMP"/*.tgz)
[ "${#TARBALLS[@]}" -eq 1 ] || fail "expected exactly one tarball, got ${#TARBALLS[@]}"
TARBALL=${TARBALLS[0]}

echo "check: tarball contents"
LISTING=$(tar tzf "$TARBALL")
for f in \
    package/dist/kinstactl.js \
    package/dist/index.js \
    package/dist/index.d.ts \
    package/dist/client/KinstaClient.d.ts \
    package/README.md \
    package/LICENSE; do
    grep -qxF "$f" <<<"$LISTING" || fail "tarball is missing $f"
done
if grep -E 'package/src/|package/dist/bin/' <<<"$LISTING"; then
    fail "tarball contains source or binaries"
fi
if grep -E '\.ts$' <<<"$LISTING" | grep -vE '\.d\.ts$'; then
    fail "tarball contains non-declaration .ts files"
fi

echo "check: shebang"
SHEBANG=$(head -1 dist/kinstactl.js)
[ "$SHEBANG" = '#!/usr/bin/env node' ] || fail "unexpected shebang: $SHEBANG"

echo "check: install into a scratch project"
CONSUMER="$TMP/consumer"
mkdir "$CONSUMER"
cd "$CONSUMER"
npm init -y >/dev/null
npm install "$TARBALL" typescript@5 @types/node@22 --no-audit --no-fund

# Keep the CLI away from the real user config.
export HOME="$TMP/home"
export XDG_CONFIG_HOME="$TMP/home/.config"
export XDG_CACHE_HOME="$TMP/home/.cache"
mkdir -p "$HOME"

echo "check: --version"
EXPECTED=$(node -p "require('$REPO/package.json').version")
ACTUAL=$(npx kinstactl --version </dev/null)
[ "$ACTUAL" = "$EXPECTED" ] || fail "--version printed '$ACTUAL', expected '$EXPECTED'"

echo "check: commands --json"
COMMANDS=$(npx kinstactl commands --json </dev/null)
HEAD=${COMMANDS:0:19}
[ "$HEAD" = '{"name":"kinstactl"' ] || fail "commands --json starts with '$HEAD'"

echo "check: auth status without credentials fails"
if KINSTA_API_KEY= npx kinstactl auth status </dev/null; then
    fail "auth status exited 0 without credentials"
fi

echo "check: library import"
node -e "import('kinstactl').then((m) => { if (typeof m.KinstaClient !== 'function') process.exit(1); })" ||
    fail "KinstaClient is not exported from the package"

echo "check: type declarations"
cat >"$CONSUMER/index.ts" <<'EOF'
import {KinstaClient, sites} from 'kinstactl';

const client = new KinstaClient({apiKey: 'k', companyId: 'c'});
export const spec = sites.listSites(client.companyId, {includeEnvironments: false});
export const c: KinstaClient = client;
EOF
cat >"$CONSUMER/tsconfig.json" <<'EOF'
{
    "compilerOptions": {
        "strict": true,
        "module": "nodenext",
        "moduleResolution": "nodenext",
        "noEmit": true,
        "types": ["node"]
    },
    "files": ["index.ts"]
}
EOF
npx tsc -p "$CONSUMER" || fail "consumer project does not typecheck"

echo "smoke:package OK"
