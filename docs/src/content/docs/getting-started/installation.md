---
title: Installation
description: Install kinstactl from npm, as a standalone binary or as a Docker image.
---

kinstactl ships as an npm package, as standalone binaries and as a Docker image. They all run the same CLI.

```sh
npm i -g kinstactl
npx kinstactl --version
```

## npm

The package needs Node.js 22.12 or newer. Install it globally to get the `kinstactl` command, or run it once with `npx` without installing anything.

## Binaries

Every [release](https://github.com/rickklaasboer/kinstactl/releases) has a binary per platform, so you can run kinstactl without Node.js:

- `kinstactl-darwin-arm64`
- `kinstactl-darwin-x64`
- `kinstactl-linux-x64`
- `kinstactl-linux-arm64`
- `kinstactl-windows-x64.exe`

Each release also has a `SHA256SUMS` file. Verify the download before you run it. `--ignore-missing` skips the files you did not download.

```sh
shasum -a 256 -c --ignore-missing SHA256SUMS && chmod +x kinstactl-darwin-arm64 && ./kinstactl-darwin-arm64 --version
```

On Linux, use `sha256sum` instead of `shasum -a 256` and the `kinstactl-linux-x64` file name.

macOS quarantines a binary that you download through a browser. Clear the flag, or download with `curl -LO` instead:

```sh
xattr -d com.apple.quarantine kinstactl-darwin-arm64
```

The `darwin-x64` binary (Intel Macs) is built and attached to each release, but CI does not smoke-test it.

Like the npm package, the binaries do not load a `.env` file or a `bunfig.toml` from the working directory. Credentials come from [`kinstactl auth login`](/getting-started/authentication/) or from exported environment variables.

## Docker

The image is based on the linux-x64 binary, so it is `linux/amd64` only. It has no entrypoint: pass the command to run.

```sh
docker run --rm -e KINSTA_API_KEY -e KINSTA_COMPANY_ID ghcr.io/rickklaasboer/kinstactl kinstactl sites list
```

In GitLab CI, use it as the job image:

```yaml
list-sites:
  image: ghcr.io/rickklaasboer/kinstactl
  script: kinstactl sites list
```

Provide `KINSTA_API_KEY` and `KINSTA_COMPANY_ID` as masked CI/CD variables.
