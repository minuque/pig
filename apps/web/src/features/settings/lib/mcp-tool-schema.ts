export interface McpToolParam {
  name: string
  required: boolean
  type: string
  description?: string
  defaultValue?: string
  enumValues?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value)
}

function summarizeType(node: Record<string, unknown>): string {
  const variants = Array.isArray(node.anyOf)
    ? node.anyOf
    : Array.isArray(node.oneOf)
      ? node.oneOf
      : undefined

  if (variants) {
    const parts = variants
      .filter(isRecord)
      .map(summarizeType)
      .filter((part, index, all) => part !== "" && all.indexOf(part) === index)

    if (parts.length > 0) return parts.join(" | ")
  }

  if (Array.isArray(node.type)) return node.type.map(String).join(" | ")

  if (node.type === "array" && isRecord(node.items)) {
    const itemType = summarizeType(node.items)
    return itemType.includes(" | ") ? `(${itemType})[]` : `${itemType}[]`
  }

  if (typeof node.type === "string" && node.type) return node.type

  if (node.const !== undefined) return JSON.stringify(node.const)

  if (Array.isArray(node.enum)) return "enum"
  return "any"
}

export function extractToolParams(schema?: Record<string, unknown>): McpToolParam[] {
  if (!isRecord(schema) || !isRecord(schema.properties)) return []

  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : [],
  )
  const params = Object.entries(schema.properties)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .map(([name, prop]): McpToolParam => {
      const description =
        typeof prop.description === "string" && prop.description.trim()
          ? prop.description.trim()
          : undefined
      const enumValues = Array.isArray(prop.enum) ? prop.enum.map(formatValue) : undefined
      const defaultValue = prop.default !== undefined ? formatValue(prop.default) : undefined
      return {
        name,
        required: required.has(name),
        type: summarizeType(prop),
        ...(description ? { description } : {}),
        ...(defaultValue !== undefined ? { defaultValue } : {}),
        ...(enumValues && enumValues.length > 0 ? { enumValues } : {}),
      }
    })
  return params.sort((a, b) => Number(b.required) - Number(a.required))
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, "")} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`
}
