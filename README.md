# kinstactl

Command line client and typed TypeScript client for the Kinsta API.

## Install

### npm

Requires Node.js 22 or newer.

```sh
npm i -g kinstactl
npx kinstactl --version
```

### Binaries

Standalone binaries for macOS, Linux and Windows are attached to every [release](https://github.com/rickklaasboer/kinstactl/releases): `kinstactl-darwin-arm64`, `kinstactl-darwin-x64`, `kinstactl-linux-x64`, `kinstactl-linux-arm64` and `kinstactl-windows-x64.exe`, plus `SHA256SUMS`. Verify and run (use `shasum -a 256 -c` on macOS, `--ignore-missing` skips the files you did not download):

```sh
sha256sum -c --ignore-missing SHA256SUMS && chmod +x kinstactl-linux-x64 && ./kinstactl-linux-x64 --version
```

The darwin-x64 (Intel Mac) binary is built and attached but not smoke-tested in CI.

Like the npm package, the binaries do not load a `.env` file, so credentials come from `kinstactl auth login` or exported environment variables.

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

## Authenticate

Store an API key in a profile (prompts for the key when `--api-key` is not given):

```sh
kinstactl auth login
```

Or export the credentials. Both variables are required together and take precedence over config profiles unless `--profile` is passed:

```sh
export KINSTA_API_KEY=... KINSTA_COMPANY_ID=...
```

## Library

The package also exports a typed client. Endpoint functions build a request, `client.send` executes it.

```ts
import {KinstaClient, sites} from 'kinstactl';

const client = new KinstaClient({apiKey: process.env.KINSTA_API_KEY!, companyId: process.env.KINSTA_COMPANY_ID!});
const result = await client.send(sites.listSites(client.companyId, {includeEnvironments: false}));
```

## License

MIT
