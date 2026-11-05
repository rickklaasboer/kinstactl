---
title: Profiles
description: Store the credentials of several companies and switch between them.
---

A profile is a named set of credentials. Use one per company when you work with more than one.

```sh
kinstactl auth login --profile work
kinstactl auth profiles
kinstactl sites list --profile work
```

`auth login --profile <name>` stores the key under that name. `auth profiles` lists the stored profiles with their company ID, key name and which one is the default. `--profile` is a global flag, so it works on every command.

## Which profile is used

kinstactl picks the profile in this order:

1. the `--profile` flag
2. the `KINSTA_PROFILE` environment variable
3. the `defaultProfile` in the config file
4. a profile named `default`

The first `auth login` sets `defaultProfile` to the profile it stores, so later logins under another name do not change which one is the default. `auth logout` removes the selected profile by the same rules, and clears `defaultProfile` when it pointed at it.

```sh
KINSTA_PROFILE=work kinstactl sites list
```

An unknown profile name fails with `AUTH_MISSING` and lists the profiles that exist.

With a single company you never need any of this: `auth login` without `--profile` stores a profile called `default`, and every command uses it.
