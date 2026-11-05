---
title: Authentication
description: Log in with a Kinsta API key, or provide credentials through environment variables.
---

kinstactl needs a Kinsta API key and the ID of your company. `auth login` stores both for you.

```sh
kinstactl auth login
```

The command prompts for the API key without echoing it, validates it against the Kinsta API (`GET /validate`), and stores the key together with the company ID that Kinsta reports for it. You never type the company ID yourself.

Create the key in MyKinsta, in your company's API key settings.

## Reading the key from stdin

A key passed as `--api-key <key>` ends up in your shell history. Pass `-` to read it from stdin instead, which is also the way to log in without a terminal:

```sh
kinstactl auth login --api-key - < key.txt
```

Without a terminal and without `--api-key`, the command fails with a `USAGE` error rather than waiting for input.

## Checking and removing a login

```sh
kinstactl auth status
kinstactl auth logout
```

`auth status` shows where the credentials come from (`env` or `profile`), the company ID, the key name, its status and when it expires. It validates the key against Kinsta, so it fails when the key is revoked. `auth logout` removes the stored profile. Neither command ever prints the key itself.

## Environment variables

For CI and containers, export the credentials instead of logging in:

```sh
export KINSTA_API_KEY=<your-api-key> KINSTA_COMPANY_ID=<your-company-id>
```

Both variables are required together. Setting only one fails with `AUTH_MISSING`. They win over the config file, unless you pass `--profile`, which always selects a stored profile (see [Profiles](/getting-started/profiles/)).

## Where the key is stored

`auth login` writes `~/.config/kinstactl/config.json`, or `$XDG_CONFIG_HOME/kinstactl/config.json` when `XDG_CONFIG_HOME` is set. The file is created with mode `0600`, so only your user can read it. The API key is stored in it in plain text.
