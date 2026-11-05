import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type ConfigFile, saveConfig } from '@/cli/config'
import { run } from '@/cli/program'
import type { Io } from '@/cli/runtime'
import type { Prompts } from '@/cli/prompts'
import { type FakeCall, type FakeRoute, fakeKinsta } from './fakeKinsta'

export interface RunCliOpts {
  routes?: Record<string, FakeRoute | FakeRoute[]>
  tty?: boolean
  /** A value of undefined removes the default. */
  env?: Record<string, string | undefined>
  prompts?: Partial<Prompts>
  io?: Partial<Io>
  /** Written to the config file before the run. */
  config?: ConfigFile
}

export interface RunCliResult {
  code: number
  stdout: string
  stderr: string
  calls: FakeCall[]
  env: NodeJS.ProcessEnv
}

function unanswered(name: string) {
  return async () => {
    throw new Error(`runCli: unanswered prompt: ${name}`)
  }
}

export async function runCli(argv: string[], opts: RunCliOpts = {}): Promise<RunCliResult> {
  const dir = mkdtempSync(join(tmpdir(), 'kinstactl-'))
  const env: NodeJS.ProcessEnv = {
    KINSTA_API_KEY: 'test-key',
    KINSTA_COMPANY_ID: 'c1',
    NO_COLOR: '1',
    HOME: dir,
    XDG_CONFIG_HOME: join(dir, 'config'),
    XDG_CACHE_HOME: join(dir, 'cache'),
  }
  for (const [k, v] of Object.entries(opts.env ?? {})) {
    if (v === undefined) delete env[k]
    else env[k] = v
  }

  if (opts.config) saveConfig(env, opts.config)

  const fake = fakeKinsta(opts.routes ?? {})
  let stdout = ''
  let stderr = ''
  const io: Io = {
    stdout: (s) => {
      stdout += s
    },
    stderr: (s) => {
      stderr += s
    },
    isTTY: opts.tty ?? false,
    env,
    fetchFn: fake.fetch,
    sleep: async () => {},
    prompts: {
      select: unanswered('select'),
      search: unanswered('search'),
      confirm: unanswered('confirm'),
      text: unanswered('text'),
      ...opts.prompts,
    } as Prompts,
    ...opts.io,
  }
  const code = await run(argv, io)
  return { code, stdout, stderr, calls: fake.calls, env }
}
