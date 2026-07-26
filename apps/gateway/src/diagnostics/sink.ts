import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

export type SafeDiagnosticEvent = {
  code: string;
  severity: "info" | "warn" | "error";
  requestId?: string;
  commandId?: string;
  component?: string;
  status?: number;
  count?: number;
  state?: string;
  fingerprint?: string;
};

const stringFields = ["requestId", "commandId", "component", "state", "fingerprint"] as const;
const numberFields = ["status", "count"] as const;
// biome-ignore lint/suspicious/noControlCharactersInRegex: Diagnostic fields must strip control characters.
const clean = (value: string): string => value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 160);

export class DiagnosticSink {
  private current = "";
  private bytes = 0;

  constructor(
    private readonly dir: string,
    private readonly maxBytes = 50 * 1024 * 1024,
    private readonly segmentBytes = 1024 * 1024,
  ) {}

  async emit(event: SafeDiagnosticEvent): Promise<void> {
    const safe: Record<string, string | number> = {
      ts: new Date().toISOString(),
      code: clean(event.code),
      severity: event.severity,
    };
    for (const field of stringFields) {
      const value = event[field];
      if (typeof value === "string") safe[field] = clean(value);
    }
    for (const field of numberFields) {
      const value = event[field];
      if (typeof value === "number" && Number.isFinite(value)) safe[field] = value;
    }
    const line = `${JSON.stringify(safe)}\n`;
    try {
      await mkdir(this.dir, { recursive: true });
      if (!this.current || this.bytes + Buffer.byteLength(line) > this.segmentBytes) {
        this.current = join(this.dir, `gateway-${Date.now()}-${randomUUID()}.jsonl`);
        this.bytes = 0;
      }
      await appendFile(this.current, line, { mode: 0o600 });
      this.bytes += Buffer.byteLength(line);
      await this.trim();
    } catch {
      // Diagnostics must never take down the server.
    }
  }

  private async trim(): Promise<void> {
    const entries = await Promise.all(
      (await readdir(this.dir))
        .filter((name) => name.endsWith(".jsonl"))
        .map(async (name) => ({
          name,
          size: (await stat(join(this.dir, name))).size,
          mtime: (await stat(join(this.dir, name))).mtimeMs,
        })),
    );
    entries.sort((left, right) => left.mtime - right.mtime);
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of entries) {
      if (total <= this.maxBytes) break;
      if (join(this.dir, entry.name) === this.current) continue;
      await unlink(join(this.dir, entry.name));
      total -= entry.size;
    }
  }

  static fingerprint(code: string): string {
    return createHash("sha256").update(code).digest("hex").slice(0, 16);
  }
}
