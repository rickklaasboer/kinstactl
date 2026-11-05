# kinstactl

Command line client and typed TypeScript client for the Kinsta API.

Documentation: https://kinstactl.rickklaasboer.nl

## Install

### npm

Requires Node.js 22.12 or newer.

```sh
npm i -g kinstactl
npx kinstactl --version
```

### Binaries

Standalone binaries for macOS, Linux and Windows are attached to every [release](https://github.com/rickklaasboer/kinstactl/releases): `kinstactl-darwin-arm64`, `kinstactl-darwin-x64`, `kinstactl-linux-x64`, `kinstactl-linux-arm64` and `kinstactl-windows-x64.exe`, plus `SHA256SUMS`. Verify and run (`--ignore-missing` skips the files you did not download):

```sh
sha256sum -c --ignore-missing SHA256SUMS && chmod +x kinstactl-linux-x64 && ./kinstactl-linux-x64 --version
```

On macOS:

```sh
shasum -a 256 -c --ignore-missing SHA256SUMS && chmod +x kinstactl-darwin-arm64 && ./kinstactl-darwin-arm64 --version
```

A binary downloaded through a browser on macOS is quarantined by Gatekeeper; clear it with `xattr -d com.apple.quarantine kinstactl-darwin-arm64` (or download with `curl -LO`).

The darwin-x64 (Intel Mac) binary is built and attached but not smoke-tested in CI.

Like the npm package, the binaries do not load a `.env` file or a `bunfig.toml` from the working directory, so credentials come from `kinstactl auth login` or exported environment variables.

### Docker

The image is based on the linux-x64 binary (linux/amd64 only) and has no entrypoint, so pass the command to run:

```sh
docker run --rm -e KINSTA_API_KEY -e KINSTA_COMPANY_ID ghcr.io/rickklaasboer/kinstactl kinstactl sites list
```

In GitLab CI:

```yaml
list-sites:
  image: ghcr.io/rickklaasboer/kinstactl
  script: kinstactl sites list
```

`KINSTA_API_KEY` and `KINSTA_COMPANY_ID` come from masked CI/CD variables.

## Authenticate

Store an API key in a profile (prompts for the key when `--api-key` is not given):

```sh
kinstactl auth login
```

`kinstactl auth login --api-key -` reads the key from stdin instead, which keeps it out of your shell history.

Or export the credentials. Both variables are required together and take precedence over config profiles unless `--profile` is passed:

```sh
export KINSTA_API_KEY=<your-api-key> KINSTA_COMPANY_ID=<your-company-id>
```

## Library

The package also exports a typed client. Endpoint functions build a request, `client.send` executes it.

```ts
import {KinstaClient, sites} from 'kinstactl';

const client = new KinstaClient({apiKey: process.env.KINSTA_API_KEY!, companyId: process.env.KINSTA_COMPANY_ID!});
const result = await client.send(sites.listSites(client.companyId, {includeEnvironments: false}));
```

## For agents

Give your coding agent this prompt; it is the body of the skill in `skills/kinstactl/SKILL.md` and the same text as the docs page.

<!-- agents-prompt:start -->
```text
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

- After you show the dry run, wait for the human's go-ahead before you run the write itself, whatever its confirmation level.
- Never pass --yes or --confirm without the human's explicit approval for that specific action. Approval for one action is not approval for the next.
- --confirm <site-name> exists only for irreversible actions, and takes the exact site name.
- Treat passwords, login links and tokens that commands print (ssh password get, wp login, db login) like the API key: never log, echo or store them, and show them to the human only when that was the point of the request.

Long operations
- Prefer --no-wait. With --json the response has an operation_id; read it from the JSON, then wait for it:

kinstactl operations wait <operation-id> --json --no-input

- Use --timeout <minutes> on the wait if the default of 30 is too short or too long.

Documentation
- The docs are at https://kinstactl.rickklaasboer.nl
- A plain-text version for agents is at https://kinstactl.rickklaasboer.nl/llms.txt
```
<!-- agents-prompt:end -->

Install it as a skill: `mkdir -p ~/.claude/skills/kinstactl && curl -fsSL https://raw.githubusercontent.com/rickklaasboer/kinstactl/main/skills/kinstactl/SKILL.md -o ~/.claude/skills/kinstactl/SKILL.md`. More at https://kinstactl.rickklaasboer.nl/for-agents/.

## License

MIT
