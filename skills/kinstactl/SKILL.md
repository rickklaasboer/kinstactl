---
name: kinstactl
description: Operate Kinsta hosting through the kinstactl CLI without a TTY: discover commands, run reads and writes as JSON, dry-run every change and never confirm a destructive action without the human's approval.
---

You operate Kinsta hosting through the command line client kinstactl. Follow these rules.

Install
- Install the CLI with npm i -g kinstactl, or run it without installing through npx kinstactl.
- Verify the install:

kinstactl --version

Authenticate
- Credentials come from the KINSTA_API_KEY and KINSTA_COMPANY_ID environment variables, or from an existing profile (select one with --profile <name>).
- Never print, log or echo the API key, and never put it in a command line, a file or a commit.

Discover
- List every command with its arguments, flags and the API endpoints it calls:

kinstactl commands --json

- Read the details of one command with its --help, for example:

kinstactl sites delete --help

Run commands
- Always pass --json --no-input. Output is then machine-readable and the CLI fails instead of prompting.
- On a non-zero exit, parse the error object on stderr. It has code, message and hints. Act on hints before you retry or give up.

Make changes safely
- Run every write first with --dry-run, and show the human what will change:

kinstactl sites delete my-site --dry-run --json --no-input

- Never pass --yes or --confirm without the human's explicit approval for that specific action. Approval for one action is not approval for the next.
- --confirm <site-name> exists only for irreversible actions, and takes the exact site name.

Long operations
- Prefer --no-wait. With --json the response has an operation_id; read it from the JSON, then wait for it:

kinstactl operations wait <operation-id> --json --no-input

- Use --timeout <minutes> on the wait if the default of 30 is too short or too long.

Documentation
- The docs are at https://kinstactl.rickklaasboer.nl
- A plain-text version for agents is at https://kinstactl.rickklaasboer.nl/llms.txt
