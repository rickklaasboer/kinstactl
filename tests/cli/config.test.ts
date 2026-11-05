import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configPath, loadConfig, resolveCredentials, saveConfig } from '@/cli/config'
import { CliError } from '@/cli/errors'

let dir: string
let env: NodeJS.ProcessEnv

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kinstactl-config-'))
  env = { XDG_CONFIG_HOME: dir }
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function catchCliError(fn: () => unknown): CliError {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(CliError)
    return e as CliError
  }
  throw new Error('expected CliError, nothing thrown')
}

const cfg = {
  defaultProfile: 'work',
  profiles: {
    work: { apiKey: 'key-work', companyId: 'co-work', keyName: 'laptop' },
    home: { apiKey: 'key-home', companyId: 'co-home' },
  },
}

describe('config file', () => {
  test('configPath honours XDG_CONFIG_HOME, else HOME/.config', () => {
    expect(configPath(env)).toBe(join(dir, 'kinstactl', 'config.json'))
    expect(configPath({ HOME: '/home/x' })).toBe('/home/x/.config/kinstactl/config.json')
  })

  test('missing file loads as empty config', () => {
    expect(loadConfig(env)).toEqual({ profiles: {} })
  })

  test('save then load round-trips', () => {
    saveConfig(env, cfg)
    expect(loadConfig(env)).toEqual(cfg)
  })

  test('file mode is 0600', () => {
    saveConfig(env, cfg)
    expect(statSync(configPath(env)).mode & 0o777).toBe(0o600)
  })

  test('invalid JSON throws USAGE naming the path', () => {
    mkdirSync(join(dir, 'kinstactl'), { recursive: true })
    writeFileSync(configPath(env), '{nope')
    const err = catchCliError(() => loadConfig(env))
    expect(err.code).toBe('USAGE')
    expect(err.message).toContain(configPath(env))
  })
})

describe('resolveCredentials', () => {
  test('KINSTA_API_KEY + KINSTA_COMPANY_ID beat the profile, no config needed', () => {
    expect(resolveCredentials({ ...env, KINSTA_API_KEY: 'k', KINSTA_COMPANY_ID: 'c' }, {})).toEqual({
      apiKey: 'k',
      companyId: 'c',
      source: 'env',
    })
    saveConfig(env, cfg)
    expect(resolveCredentials({ ...env, KINSTA_API_KEY: 'k', KINSTA_COMPANY_ID: 'c' }, {}).source).toBe('env')
  })

  test('KINSTA_API_KEY without KINSTA_COMPANY_ID throws AUTH_MISSING', () => {
    const err = catchCliError(() => resolveCredentials({ ...env, KINSTA_API_KEY: 'k' }, {}))
    expect(err.code).toBe('AUTH_MISSING')
    expect(err.hints.join(' ')).toContain('KINSTA_COMPANY_ID')
  })

  test('uses defaultProfile when nothing else is given', () => {
    saveConfig(env, cfg)
    expect(resolveCredentials(env, {})).toEqual({
      apiKey: 'key-work',
      companyId: 'co-work',
      source: 'profile',
      profile: 'work',
    })
  })

  test('falls back to profile named default', () => {
    saveConfig(env, { profiles: { default: { apiKey: 'a', companyId: 'b' } } })
    expect(resolveCredentials(env, {}).profile).toBe('default')
  })

  test('KINSTA_PROFILE beats defaultProfile', () => {
    saveConfig(env, cfg)
    expect(resolveCredentials({ ...env, KINSTA_PROFILE: 'home' }, {}).profile).toBe('home')
  })

  test('--profile beats KINSTA_PROFILE', () => {
    saveConfig(env, cfg)
    const creds = resolveCredentials({ ...env, KINSTA_PROFILE: 'home' }, { profile: 'work' })
    expect(creds.profile).toBe('work')
    expect(creds.apiKey).toBe('key-work')
  })

  test('unknown profile throws AUTH_MISSING listing existing profiles', () => {
    saveConfig(env, cfg)
    const err = catchCliError(() => resolveCredentials(env, { profile: 'nope' }))
    expect(err.code).toBe('AUTH_MISSING')
    expect(err.message).toContain('nope')
    expect(err.hints.join(' ')).toContain('work')
    expect(err.hints.join(' ')).toContain('home')
  })

  test('nothing configured throws AUTH_MISSING with login hint', () => {
    const err = catchCliError(() => resolveCredentials(env, {}))
    expect(err.code).toBe('AUTH_MISSING')
    expect(err.hints).toContain('Run: kinstactl auth login')
  })
})
