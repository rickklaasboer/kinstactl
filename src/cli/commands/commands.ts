import type { Command } from 'commander'
import type { EndpointKey } from '@/client/request'
import { getMeta, meta } from '../program'
import type { Runtime } from '../runtime'

interface CommandNode {
  name: string
  path: string
  description: string
  arguments: { name: string; required: boolean; description: string }[]
  options: { flags: string; description: string }[]
  destructive: 'confirm' | 'irreversible' | null
  endpoints: EndpointKey[]
  commands: CommandNode[]
}

function describeCommand(cmd: Command, parentPath: string, globals: Command['options']): CommandNode {
  const path = cmd.parent ? [parentPath, cmd.name()].filter(Boolean).join(' ') : ''
  const isLeaf = cmd.commands.length === 0
  // Global options are accepted on every command, so a leaf lists them too.
  const options = isLeaf && cmd.parent ? [...cmd.options, ...globals] : cmd.options
  return {
    name: cmd.name(),
    path,
    description: cmd.description(),
    arguments: cmd.registeredArguments.map((a) => ({
      name: a.name(),
      required: a.required,
      description: a.description,
    })),
    options: options.map((o) => ({ flags: o.flags, description: o.description })),
    destructive: getMeta(cmd)?.destructive ?? null,
    endpoints: getMeta(cmd)?.endpoints ?? [],
    commands: cmd.commands.map((c) => describeCommand(c, path, globals)),
  }
}

function renderList(node: CommandNode, depth: number): string[] {
  const args = node.arguments.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(' ')
  const label = [node.name, args].filter(Boolean).join(' ')
  const line = `${'  '.repeat(depth)}${label}${node.description ? `  ${node.description}` : ''}`
  return [line, ...node.commands.flatMap((c) => renderList(c, depth + 1))]
}

export function registerCommands(program: Command, rt: Runtime): void {
  meta(
    program
      .command('commands')
      .description('List all commands, their options and the API endpoints they use')
      .addHelpText('after', '\nExamples:\n  $ kinstactl commands\n  $ kinstactl commands --json')
      .action(() => {
        const tree = describeCommand(program, '', program.options)
        rt.output.data(tree, () => tree.commands.flatMap((c) => renderList(c, 0)).join('\n'))
      }),
    { endpoints: [] },
  )
}
