import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { CliError } from './errors'

export interface Profile {
  apiKey: string
  companyId: string
  keyName?: string
}

export interface ConfigFile {
  defaultProfile?: string
  profiles: Record<string, Profile>
}

export interface Credentials {
  apiKey: string
  companyId: string
  source: 'env' | 'profile'
  profile?: string
}

export function configPath(env: NodeJS.ProcessEnv): string {
  const base = env.XDG_CONFIG_HOME || join(env.HOME || homedir(), '.config')
  return join(base, 'kinstactl', 'config.json')
}

export function loadConfig(env: NodeJS.ProcessEnv): ConfigFile {
  const path = configPath(env)
  if (!existsSync(path)) return { profiles: {} }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new CliError('USAGE', `Config file ${path} is not valid JSON: ${(e as Error).message}`, [
      `Fix or delete ${path}`,
    ])
  }
  return validateConfig(parsed, path)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateConfig(raw: unknown, path: string): ConfigFile {
  const invalid = (what: string) =>
    new CliError('USAGE', `Config file ${path} is invalid: ${what}`, [`Fix or delete ${path}`])

  if (!isRecord(raw) || !isRecord(raw.profiles)) throw invalid('expected an object with a "profiles" object')
  if (raw.defaultProfile !== undefined && typeof raw.defaultProfile !== 'string') {
    throw invalid('"defaultProfile" must be a string')
  }
  for (const [name, p] of Object.entries(raw.profiles)) {
    if (!isRecord(p)) throw invalid(`profile "${name}" must be an object`)
    for (const field of ['apiKey', 'companyId'] as const) {
      if (typeof p[field] !== 'string' || p[field] === '') {
        throw invalid(`profile "${name}" needs a non-empty string "${field}"`)
      }
    }
    if (p.keyName !== undefined && typeof p.keyName !== 'string') {
      throw invalid(`profile "${name}" has a non-string "keyName"`)
    }
  }
  return raw as unknown as ConfigFile
}

export function saveConfig(env: NodeJS.ProcessEnv, cfg: ConfigFile): void {
  const path = configPath(env)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
  // mode is ignored when the file already exists
  chmodSync(path, 0o600)
}

/** Flag > KINSTA_PROFILE > config defaultProfile > 'default'. */
export function selectedProfileName(env: NodeJS.ProcessEnv, flags: { profile?: string }, cfg: ConfigFile): string {
  return flags.profile || env.KINSTA_PROFILE || cfg.defaultProfile || 'default'
}

export function resolveCredentials(env: NodeJS.ProcessEnv, flags: { profile?: string }): Credentials {
  if (!flags.profile && (env.KINSTA_API_KEY || env.KINSTA_COMPANY_ID)) {
    if (!env.KINSTA_COMPANY_ID) {
      throw new CliError('AUTH_MISSING', 'KINSTA_API_KEY is set but KINSTA_COMPANY_ID is not', [
        'Set KINSTA_COMPANY_ID, or unset KINSTA_API_KEY to use a config profile',
      ])
    }
    if (!env.KINSTA_API_KEY) {
      throw new CliError('AUTH_MISSING', 'KINSTA_COMPANY_ID is set but KINSTA_API_KEY is not', [
        'Set KINSTA_API_KEY, or unset KINSTA_COMPANY_ID to use a config profile',
      ])
    }
    return { apiKey: env.KINSTA_API_KEY, companyId: env.KINSTA_COMPANY_ID, source: 'env' }
  }

  const cfg = loadConfig(env)
  const names = Object.keys(cfg.profiles)
  const name = selectedProfileName(env, flags, cfg)
  const profile = cfg.profiles[name]
  if (!profile) {
    const explicit = flags.profile || env.KINSTA_PROFILE || cfg.defaultProfile
    if (!explicit) {
      throw new CliError('AUTH_MISSING', 'No Kinsta credentials configured', ['Run: kinstactl auth login'])
    }
    throw new CliError('AUTH_MISSING', `Profile "${name}" not found`, [
      names.length ? `Existing profiles: ${names.join(', ')}` : 'No profiles exist yet',
      'Run: kinstactl auth login',
    ])
  }
  return { apiKey: profile.apiKey, companyId: profile.companyId, source: 'profile', profile: name }
}
