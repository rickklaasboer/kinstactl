---
title: Using the client as a library
description: Call the Kinsta API from TypeScript with the typed client that ships in the kinstactl package.
---

The kinstactl package is also a typed client for the Kinsta API. The CLI is built on it, and you can use it directly in your own scripts and services.

```sh
npm i kinstactl
```

```ts
import {KinstaClient, sites} from 'kinstactl';

const client = new KinstaClient({
    apiKey: process.env.KINSTA_API_KEY!,
    companyId: process.env.KINSTA_COMPANY_ID!,
});
const result = await client.send(
    sites.listSites(client.companyId, {includeEnvironments: false}),
);
```

Endpoint builders such as `sites.listSites` only build a request description (method, path, query and body). `client.send(spec)` executes it and resolves with the parsed response body. Splitting the two keeps the builders free of I/O, so they are easy to test and to reuse. The builders are grouped by area, one namespace each; the table at the end lists them.

## Operations that run in the background

Many Kinsta endpoints answer with an `operation_id` and finish later. `client.start(spec)` sends such a request and returns an `Operation`, which you can `wait()` on.

```ts
import {KinstaClient, tools} from 'kinstactl';

const client = new KinstaClient({
    apiKey: process.env.KINSTA_API_KEY!,
    companyId: process.env.KINSTA_COMPANY_ID!,
});
const operation = await client.start(tools.clearCache('<environment-id>'));
const result = await operation.wait({timeoutMs: 10 * 60_000});
console.log(operation.id, result.message);
```

`wait()` polls the operation with a growing interval and resolves with `{message, data}` once Kinsta reports it as done. `timeoutMs` defaults to 30 minutes. `start` throws a `KinstaApiError` when the response carries no operation ID. When you already have an ID, for example from a CLI run with `--no-wait`, `client.operation('<operation-id>')` gives you the same handle. Use `client.send` for endpoints that answer immediately, and `client.start` for the ones that start an operation.

## Errors

Every failure is one of three classes, all exported from the package.

| Class | Thrown when |
| --- | --- |
| `KinstaApiError` | Kinsta answered with an error status (`status` and `body` hold the details), or the request failed before an answer arrived (`status` is `0`). |
| `OperationFailedError` | An operation ended in failure. `operationId` names it. |
| `OperationTimeoutError` | `wait()` ran out of time, or lost contact with Kinsta while waiting. The operation may still complete on Kinsta's side, so check it before you start it again. |

```ts
import {KinstaApiError, OperationTimeoutError} from 'kinstactl';

try {
    await operation.wait();
} catch (e) {
    if (e instanceof OperationTimeoutError) console.error(e.operationId);
    else if (e instanceof KinstaApiError) console.error(e.status, e.body);
    else throw e;
}
```

## Rate limits and retries

The client keeps to Kinsta's rate limits for you: at most 100 requests per minute, and 4 per minute for requests that create something, and it pauses when Kinsta reports that no requests remain. A `429` answer is retried up to three times, waiting for the `Retry-After` period, or with a doubling delay when it is absent. `GET` requests are also retried up to three times on a gateway error (`502`, `503`, `504`). Other methods are never retried on a `5xx`, because the request may have been processed and repeating it could, for example, create a second backup. Each attempt times out after 120 seconds.

## Types

The package exports the types generated from Kinsta's OpenAPI description as `paths` and `components`, so you can type request and response bodies without writing them out.

```ts
import type {components} from 'kinstactl';

type ClearCacheBody = components['schemas']['ClearCacheRequestBody'];
```

`RequestSpec`, `KinstaClientOptions` and `WaitOpts` are exported as types too.

## Requirements

The package is ESM only: use `import`, not `require`. It needs Node.js 22.12 or newer. The client has no dependency on the CLI code, and none of the CLI's libraries are loaded when you import it.

## Exports

| Export | What it is |
| --- | --- |
| `KinstaClient` | The client: `send`, `start`, `raw`, `operation` and `companyId`. |
| `Operation` | The handle of a background operation, with `id` and `wait()`. |
| `KinstaApiError` | Error for failed HTTP calls. |
| `OperationFailedError` | Error for a failed operation. |
| `OperationTimeoutError` | Error for an operation whose outcome is unknown. |
| `account` | Endpoint builders for the company, its users, API keys and activity logs. |
| `sites` | Endpoint builders for sites. |
| `environments` | Endpoint builders for environments. |
| `tools` | Endpoint builders for cache, PHP, search and replace and similar tools. |
| `backups` | Endpoint builders for backups. |
| `domains` | Endpoint builders for domains. |
| `logs` | Endpoint builders for logs. |
| `plugins` | Endpoint builders for plugins and themes. |
| `dns` | Endpoint builders for DNS records. |
| `wp` | Endpoint builders for WP-CLI, WordPress admin users and login links. |
| `ssh` | Endpoint builders for SSH access. |
| `sftp` | Endpoint builders for SFTP users. |
| `security` | Endpoint builders for security settings. |
| `analytics` | Endpoint builders for analytics. |
