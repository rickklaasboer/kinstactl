import { describe, expect, test } from 'bun:test'
import { CommanderError } from 'commander'
import { CliError, type ErrorCode, toCliError } from '@/cli/errors'
import { KinstaApiError, OperationFailedError, OperationTimeoutError } from '@/client/errors'

describe('toCliError', () => {
  test('maps a 401 to AUTH_INVALID with a login hint', () => {
    const e = toCliError(new KinstaApiError(401, 'Unauthorized'))
    expect(e.code).toBe('AUTH_INVALID')
    expect(e.hints).toContain('Run: kinstactl auth login')
  })

  test('maps other API errors to API_ERROR', () => {
    const e = toCliError(new KinstaApiError(500, 'boom'))
    expect([e.code, e.message, e.exitCode]).toEqual(['API_ERROR', 'boom', 1])
  })

  test('maps operation errors', () => {
    expect(toCliError(new OperationFailedError('op1', 'failed')).code).toBe('OPERATION_FAILED')
    expect(toCliError(new OperationTimeoutError('op1', 'slow')).code).toBe('OPERATION_TIMEOUT')
  })

  test('maps commander errors to USAGE without the "error: " prefix', () => {
    const e = toCliError(new CommanderError(1, 'commander.unknownOption', "error: unknown option '--x'"))
    expect([e.code, e.message]).toEqual(['USAGE', "unknown option '--x'"])
  })

  test('passes a CliError through and wraps anything else as API_ERROR', () => {
    const cli = new CliError('SITE_NOT_FOUND', 'nope')
    expect(toCliError(cli)).toBe(cli)
    expect(toCliError(new Error('unexpected')).code).toBe('API_ERROR')
    expect(toCliError('str').message).toBe('str')
  })
})

describe('CliError exit codes', () => {
  const table: Array<[ErrorCode, number]> = [
    ['USAGE', 2],
    ['AUTH_MISSING', 2],
    ['SITE_NOT_FOUND', 2],
    ['SITE_AMBIGUOUS', 2],
    ['ENV_REQUIRED', 2],
    ['ENV_NOT_FOUND', 2],
    ['API_ERROR', 1],
    ['AUTH_INVALID', 1],
    ['OPERATION_FAILED', 3],
    ['OPERATION_TIMEOUT', 4],
    ['CONFIRMATION_REQUIRED', 5],
    ['CONFIRMATION_DECLINED', 5],
  ]
  for (const [code, exit] of table) {
    test(`${code} exits ${exit}`, () => {
      expect(new CliError(code, 'm').exitCode).toBe(exit)
    })
  }

  test('keeps message, code and hints', () => {
    const e = new CliError('USAGE', 'bad', ['try this'])
    expect(e).toBeInstanceOf(Error)
    expect([e.message, e.code, e.hints]).toEqual(['bad', 'USAGE', ['try this']])
    expect(new CliError('USAGE', 'bad').hints).toEqual([])
  })
})
