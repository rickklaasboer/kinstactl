import { describe, expect, test } from 'bun:test'
import { CliError, type ErrorCode } from '@/cli/errors'

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
