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
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ConfigFile
  } catch (e) {
    throw new CliError('USAGE', `Config file ${path} is not valid JSON: ${(e as Error).message}`, [
      `Fix or delete ${path}`,
    ])
  }
}

export function saveConfig(env: NodeJS.ProcessEnv, cfg: ConfigFile): void {
  const path = configPath(env)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
  // mode is ignored when the file already exists
  chmodSync(path, 0o600)
}

export function resolveCredentials(env: NodeJS.ProcessEnv, flags: { profile?: string }): Credentials {
  if (!flags.profile && env.KINSTA_API_KEY) {
    if (!env.KINSTA_COMPANY_ID) {
      throw new CliError('AUTH_MISSING', 'KINSTA_API_KEY is set but KINSTA_COMPANY_ID is not', [
        'Set KINSTA_COMPANY_ID, or unset KINSTA_API_KEY to use a config profile',
      ])
    }
    return { apiKey: env.KINSTA_API_KEY, companyId: env.KINSTA_COMPANY_ID, source: 'env' }
  }

  const cfg = loadConfig(env)
  const names = Object.keys(cfg.profiles)
  const name = flags.profile || env.KINSTA_PROFILE || cfg.defaultProfile || 'default'
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
