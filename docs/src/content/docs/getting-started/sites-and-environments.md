---
title: Sites and environments
description: Refer to sites and environments by name, display name or ID.
---

Commands take a `<site>` argument and, for environment-specific actions, an `--env <environment>` flag. You use names; kinstactl looks up the IDs.

```sh
kinstactl cache clear klant-x --env live
```

## Sites

`<site>` accepts the site name, its display name or its ID. kinstactl matches exactly first, ignoring case. When nothing matches exactly, it accepts a prefix, as long as the prefix identifies one site.

- No match fails with `SITE_NOT_FOUND`. The `hints` of the error list the closest site names.
- A prefix that matches several sites fails with `SITE_AMBIGUOUS`, and the `hints` list the candidates.

Without `<site>`, a command on a terminal shows a searchable picker. In a script, `--no-input` or CI it fails with a `USAGE` error instead.

## Environments

`--env <environment>` accepts the same three forms as a site: name, display name or ID, exact first and then an unambiguous prefix.

When you leave `--env` out:

- A site with one environment uses that one, and kinstactl says so.
- On a terminal, you get a picker with the live environment first.
- In a script, the command fails with `ENV_REQUIRED`, and the `hints` list one `--env <name>` suggestion per environment.

Pass `--env` explicitly in scripts, so a command never depends on whether a terminal is attached.

## The site cache

Looking up a name needs the list of your sites. kinstactl caches that list for five minutes in `~/.cache/kinstactl`, or in `$XDG_CACHE_HOME/kinstactl` when `XDG_CACHE_HOME` is set, with one file per company.

```sh
kinstactl sites list --refresh
```

`--refresh` bypasses the cache and rewrites it. Commands that change something always resolve the site against fresh data, so a stale cache can never point a write at the wrong site.

## Shell completion

Site and environment names complete in your shell once you install the completion script, for example `eval "$(kinstactl completion bash)"`. See [completion](/commands/completion/) for bash, zsh and fish.
