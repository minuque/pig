function nestedMessage(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const record = value as { message?: unknown; error?: unknown }

  if (typeof record.message === "string" && record.message.trim()) return record.message
  return nestedMessage(record.error)
}

export function errorSummary(text: string): string {
  const start = text.indexOf("{")

  if (start < 0) return text

  try {
    return nestedMessage(JSON.parse(text.slice(start))) ?? text
  } catch {
    return text
  }
}
