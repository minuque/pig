import { createHmac } from "node:crypto"
import { readFile } from "node:fs/promises"

const escape = (text: string) => text.replace(/[.+^${}()|[\]\\]/g, String.raw`\$&`)

/** known_hosts 主机字段里的一项：明文（可带 * ? 与 [host]:port）或 |1|salt|hash 散列。 */
function matches(pattern: string, name: string): boolean {
  if (pattern.startsWith("|1|")) {
    const [, , salt = "", hash] = pattern.split("|")
    return createHmac("sha1", Buffer.from(salt, "base64")).update(name).digest("base64") === hash
  }

  const source = escape(pattern).replaceAll("*", ".*").replaceAll("?", ".")
  return new RegExp(`^${source}$`, "i").test(name)
}

/** 照 OpenSSH 读 known_hosts：返回该主机受信与被吊销的公钥（ssh wire 格式）。 */
export async function knownHostKeys(files: readonly string[], host: string, port: number) {
  const name = port === 22 ? host : `[${host}]:${port}`
  const trusted: Buffer[] = []
  const revoked: Buffer[] = []

  for (const file of files) {
    const text = await readFile(file, "utf8").catch(() => "")

    for (const line of text.split(/\r?\n/)) {
      const fields = line.trim().split(/\s+/)

      if (!fields[0] || fields[0].startsWith("#")) continue
      const marker = fields[0].startsWith("@") ? fields.shift() : undefined
      const [hosts, , key] = fields

      if (!hosts || !key || marker === "@cert-authority") continue
      const patterns = hosts.split(",")

      if (patterns.some((item) => item.startsWith("!") && matches(item.slice(1), name))) continue

      if (!patterns.some((item) => !item.startsWith("!") && matches(item, name))) continue
      ;(marker === "@revoked" ? revoked : trusted).push(Buffer.from(key, "base64"))
    }
  }

  return { trusted, revoked }
}
