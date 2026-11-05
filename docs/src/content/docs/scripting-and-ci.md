---
title: Scripting and CI
description: Run kinstactl from scripts and CI pipelines with JSON output, no prompts, dry runs, exit codes and environment variables.
---

kinstactl is built to be called from scripts. Output is machine-readable on demand, nothing prompts when no one is there to answer, and every failure has a stable code and exit status.

## Machine-readable output

Pass `--json` to get JSON on stdout.

```sh
kinstactl sites list --json | jq -r '.[].name'
```

With `--json`, stdout holds only the result document. Human messages such as progress lines and hints go to stderr, and are left out entirely in JSON mode, so `stdout` is always safe to pipe into `jq`. Errors are printed to stderr as JSON too; see [Exit codes and the error object](#exit-codes-and-the-error-object).

The JSON shapes are documented per command and kept stable. Changing a field name or removing one is a breaking change and ships as one. To discover every command, argument and flag programmatically, ask kinstactl itself:

```sh
kinstactl commands --json
```

## No prompts

A script must never wait for input. kinstactl prompts only when stdin and stdout are both a terminal, and not when any of these is true:

- you pass `--json`,
- you pass the global `--no-input` flag,
- `KINSTACTL_NO_INPUT=1` is set,
- `CI=true` is set (most CI systems set it).

```sh
kinstactl backups create my-site --env live --no-input
```

When a command would have prompted, it fails instead, with the code that names what is missing. Pass every value a prompt would have asked for:

- `--env <environment>` is required when the site has more than one environment, otherwise the command fails with `ENV_REQUIRED`. A site with a single environment uses it without `--env`, but pass it anyway so the script keeps working when a second environment appears.
- A missing `<site>` argument fails with a `USAGE` error.
- `auth login` needs `--api-key <key>` (or `--api-key -` for stdin) and fails with `USAGE` without it.
- Confirmations are covered in the next section.

kinstactl prints colour only on a terminal. Set `NO_COLOR=1` to turn it off there as well.

## Confirmations

Destructive commands ask before they act. In a script you answer in advance with a flag.

```sh
kinstactl backups restore my-site 123456789 --env live --notify admin@example.com --yes
kinstactl sites delete my-site --confirm my-site
```

Two levels exist, and `kinstactl <command> --help` shows which flag a command takes:

- `--yes` skips the confirmation of a command that is destructive but recoverable, such as `backups restore`.
- `--confirm <site-name>` is required for irreversible commands, such as `sites delete`. `--yes` is deliberately not accepted there: you pass the name of the site, so a copy-pasted command cannot delete the wrong one.

Without the flag, and without a terminal, the command fails with `CONFIRMATION_REQUIRED` (exit 5). A `--confirm` value that does not match the site also gives `CONFIRMATION_REQUIRED`. On a terminal, answering no gives `CONFIRMATION_DECLINED`, also exit 5.

## Dry runs

`--dry-run` resolves everything and prints what would be sent, without sending it.

```sh
kinstactl cache clear my-site --env live --dry-run --json
```

Every command that changes something takes `--dry-run`. The output is a single document:

```json
{
  "dry_run": true,
  "target": {
    "site": {"id": "<site-id>", "name": "my-site"},
    "env": {"id": "<environment-id>", "name": "live"}
  },
  "request": {
    "method": "POST",
    "path": "/sites/tools/clear-cache",
    "body": {"environment_id": "<environment-id>"}
  }
}
```

`target` holds the resolved site and environment, and `request` the HTTP method, path, query and body. Secrets in the body, such as passwords and API keys, are redacted. A dry run happens before the confirmation, so it never asks for `--yes` or `--confirm`. Use it to check that a script points at the right site and environment before you let it run for real.

## Long operations

Many commands start a Kinsta operation and wait for it to finish. In a script, you can start it and come back later.

```sh
kinstactl backups create my-site --env live --no-wait --json
kinstactl operations wait <operation-id> --timeout 10
```

With `--json`, `--no-wait` prints `{"operation_id": "...", "status": "pending"}` on stdout. Without `--json` it prints a `Started ...` line on stdout and the operation ID only in the `Follow with: kinstactl operations wait <id>` hint on stderr, so use `--json` when a script has to capture the ID.

Not every write command takes `--no-wait`. Commands that finish immediately, such as `ssh enable` or `security redirects add`, have no operation to wait for; `kinstactl <command> --help` lists the flags.

`operations wait` and the waiting commands take `--timeout <minutes>` (default 30). A failed operation exits with code 3 (`OPERATION_FAILED`). A wait that ends before the operation does exits with code 4 (`OPERATION_TIMEOUT`); the operation may still complete on Kinsta's side, so check it with `kinstactl operations get <operation-id>` instead of starting it again.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `KINSTA_API_KEY` | The Kinsta API key. Set it together with `KINSTA_COMPANY_ID`. |
| `KINSTA_COMPANY_ID` | The ID of your company. Set it together with `KINSTA_API_KEY`. |
| `KINSTA_PROFILE` | The stored profile to use when `--profile` is not given. |
| `KINSTACTL_NO_INPUT` | Set to `1` to never prompt, like `--no-input`. |
| `KINSTACTL_DEBUG` | Set to `1` to add the stack trace of unexpected errors to the JSON error object. |
| `CI` | When `true`, kinstactl never prompts, like `--no-input`. |
| `NO_COLOR` | Set to a non-empty value to turn off colour. |
| `XDG_CONFIG_HOME` | Base directory of the config file, `~/.config` by default. |
| `XDG_CACHE_HOME` | Base directory of the site cache, `~/.cache` by default. |

`KINSTA_API_KEY` and `KINSTA_COMPANY_ID` win over the config file; see [Authentication](/getting-started/authentication/). `--profile` always selects a stored profile instead.

## Exit codes and the error object

Every failure has a code, and the code decides the exit status.

| Code | Exit | Meaning |
| --- | --- | --- |
| `USAGE` | 2 | Unknown command or flag, or a required argument or value is missing. |
| `AUTH_MISSING` | 2 | No credentials found, or only one of `KINSTA_API_KEY` and `KINSTA_COMPANY_ID` is set. |
| `SITE_NOT_FOUND` | 2 | No site matches the name you gave. |
| `SITE_AMBIGUOUS` | 2 | The name matches more than one site. |
| `ENV_REQUIRED` | 2 | The site has several environments and `--env` was not given. |
| `ENV_NOT_FOUND` | 2 | The site has no environment with that name, or the name matches several. |
| `API_ERROR` | 1 | The Kinsta API rejected the request, or could not be reached. |
| `INTERNAL` | 1 | An unexpected error in kinstactl itself. |
| `AUTH_INVALID` | 1 | Kinsta rejected the API key (HTTP 401). |
| `OPERATION_FAILED` | 3 | A Kinsta operation ended in failure. |
| `OPERATION_TIMEOUT` | 4 | The wait for an operation ran out, or contact with Kinsta was lost while waiting. |
| `CONFIRMATION_REQUIRED` | 5 | A destructive command needs `--yes` or `--confirm <site-name>`. |
| `CONFIRMATION_DECLINED` | 5 | The confirmation was answered with no. |

A successful run exits 0. With `--json`, the error is a single object on stderr:

```json
{
  "error": {
    "code": "ENV_REQUIRED",
    "message": "Site my-site has several environments; choose one",
    "hints": ["--env live", "--env staging"]
  }
}
```

`code` is stable and meant for scripts. `message` is for people and may change. `hints` lists suggested fixes and is empty when there are none. Set `KINSTACTL_DEBUG=1` to add a `stack` field to `INTERNAL` errors.

## A GitHub Actions example

Store the credentials as repository secrets and install kinstactl from npm.

```yaml
name: backup
on:
  schedule:
    - cron: '0 3 * * *'
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm i -g kinstactl
      - run: kinstactl backups create my-site --env live --json --no-input
        env:
          KINSTA_API_KEY: ${{ secrets.KINSTA_API_KEY }}
          KINSTA_COMPANY_ID: ${{ secrets.KINSTA_COMPANY_ID }}
```

GitHub sets `CI=true`, so the `--no-input` flag is redundant there, but it states the intent and keeps the same command working elsewhere. A non-zero exit fails the step. The job waits for the backup to finish; add `--no-wait` to start it and move on.

In GitLab CI, use the Docker image, which has no entrypoint:

```yaml
list-sites:
  image: ghcr.io/rickklaasboer/kinstactl
  script: kinstactl sites list
```

`KINSTA_API_KEY` and `KINSTA_COMPANY_ID` come from masked CI/CD variables.
