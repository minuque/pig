export type BuiltinCommand = { name: "compact"; instructions?: string } | { name: "reload" }

const BUILTIN = /^\/(compact|reload)(?:\s+([\s\S]*))?$/

export function parseBuiltinCommand(text: string): BuiltinCommand | undefined {
  const match = BUILTIN.exec(text.trim())
  const args = match?.[2]?.trim()

  if (match?.[1] === "reload") return args ? undefined : { name: "reload" }

  if (match?.[1] === "compact")
    return args ? { name: "compact", instructions: args } : { name: "compact" }
  return undefined
}
