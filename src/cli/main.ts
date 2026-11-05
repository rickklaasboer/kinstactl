#!/usr/bin/env bun
import { clackPrompts } from './prompts'
import { run } from './program'

// A closed pipe (`kinstactl ... | head`) is not an error.
process.stdout.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EPIPE') process.exit(0)
  throw e
})

process.exitCode = await run(process.argv.slice(2), {
  stdout: (s) => void process.stdout.write(s),
  stderr: (s) => void process.stderr.write(s),
  isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  env: process.env,
  prompts: clackPrompts,
})
