import { autocomplete, confirm, isCancel, password, select, text } from '@clack/prompts'
import { CliError } from './errors'

export interface PromptOption<T> {
  value: T
  label: string
  hint?: string
}

export interface Prompts {
  select<T>(message: string, options: PromptOption<T>[]): Promise<T>
  /** Like select, with type-to-filter. */
  search<T>(message: string, options: PromptOption<T>[]): Promise<T>
  confirm(message: string): Promise<boolean>
  text(message: string, opts?: { secret?: boolean }): Promise<string>
}

function answer<T>(v: T | symbol): T {
  if (isCancel(v)) throw new CliError('CONFIRMATION_DECLINED', 'Cancelled')
  return v as T
}

// clack types Option<Value> conditionally on primitives, which does not accept a generic T.
export const clackPrompts: Prompts = {
  async select<T>(message: string, options: PromptOption<T>[]) {
    return answer<T>(await select<T>({ message, options: options as never }))
  },
  async search<T>(message: string, options: PromptOption<T>[]) {
    return answer<T>(await autocomplete<T>({ message, options: options as never }))
  },
  async confirm(message) {
    return answer<boolean>(await confirm({ message }))
  },
  async text(message, opts) {
    const ask = opts?.secret ? password : text
    return answer<string>(await ask({ message }))
  },
}
