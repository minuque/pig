import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Store } from "../db/store.js";

export const PROJECTION_PARSER_VERSION = 1;

export type Projection = {
  health: "healthy" | "dirty_tail" | "quarantined" | "unavailable";
  items: Array<Record<string, unknown>>;
  name?: string;
  summary?: string;
};

type SessionProjectionRow = {
  source_byte_size: number | null;
  source_digest: string | null;
  verified_prefix_size: number | null;
  verified_prefix_digest: string | null;
  projection_parser_version: number | null;
};

const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const iso = (value: unknown) => (typeof value === "string" ? value : "1970-01-01T00:00:00.000Z");

export async function projectSession(
  store: Store,
  sessionId: string,
  file: string,
): Promise<Projection> {
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch {
    markUnavailable(store, sessionId, "unavailable");
    return { health: "unavailable", items: [] };
  }

  const previous = store.row<SessionProjectionRow>(
    "SELECT source_byte_size,source_digest,verified_prefix_size,verified_prefix_digest,projection_parser_version FROM sessions WHERE session_id=?",
    sessionId,
  );
  const previousPrefixSize = Number(previous?.verified_prefix_size ?? 0);
  const previousPrefixDigest = previous?.verified_prefix_digest;
  if (
    previousPrefixDigest &&
    (bytes.length < previousPrefixSize ||
      digest(bytes.subarray(0, previousPrefixSize)) !== previousPrefixDigest)
  ) {
    markUnavailable(store, sessionId, "quarantined");
    return { health: "quarantined", items: [] };
  }

  const parsed: Array<Record<string, any>> = [];
  let health: Projection["health"] = "healthy";
  let verifiedPrefixSize = bytes.length;
  let offset = 0;
  while (offset < bytes.length) {
    const newline = bytes.indexOf(0x0a, offset);
    const end = newline < 0 ? bytes.length : newline;
    const raw = bytes.subarray(offset, end).toString("utf8");
    if (raw.trim()) {
      try {
        parsed.push(JSON.parse(raw));
      } catch {
        if (newline < 0) {
          health = "dirty_tail";
          verifiedPrefixSize = offset;
          break;
        }
        markUnavailable(store, sessionId, "quarantined");
        return { health: "quarantined", items: [] };
      }
    }
    offset = newline < 0 ? bytes.length : newline + 1;
  }

  const header = parsed[0];
  if (
    !header ||
    header.type !== "session" ||
    typeof header.id !== "string" ||
    typeof header.cwd !== "string"
  ) {
    markUnavailable(store, sessionId, "quarantined");
    return { health: "quarantined", items: [] };
  }
  const identity = digest(JSON.stringify({ id: header.id, cwd: header.cwd }));
  const priorIdentity = store.row<{ value: string }>(
    "SELECT value FROM metadata WHERE key=?",
    `projection:identity:${sessionId}`,
  );
  if (priorIdentity && priorIdentity.value !== identity) {
    markUnavailable(store, sessionId, "quarantined");
    return { health: "quarantined", items: [] };
  }

  const ids = new Set<string>();
  const rawEntries: Array<Record<string, any>> = [];
  const items: Array<Record<string, unknown>> = [];
  let name: string | undefined;
  for (const entry of parsed.slice(1)) {
    if (typeof entry.id !== "string" || ids.has(entry.id)) {
      markUnavailable(store, sessionId, "quarantined");
      return { health: "quarantined", items: [] };
    }
    ids.add(entry.id);
    rawEntries.push(entry);
    if (entry.type === "session_info" && typeof entry.name === "string") {
      name = entry.name;
    }
    const item = normalize(entry);
    if (item) items.push(item);
  }

  const byId = new Map(rawEntries.map((entry) => [entry.id, entry]));
  const hasParentLinks = rawEntries.some((entry) => typeof entry.parentId === "string");
  const activeRaw = new Set<string>();
  if (hasParentLinks) {
    let leaf = [...rawEntries].reverse().find((entry) => entry.id);
    while (leaf && !activeRaw.has(leaf.id)) {
      activeRaw.add(leaf.id);
      leaf = typeof leaf.parentId === "string" ? byId.get(leaf.parentId) : undefined;
    }
  }
  const searchable = items
    .filter(
      (item) =>
        item.kind === "message" &&
        (item.role === "user" || item.role === "assistant") &&
        (!hasParentLinks || activeRaw.has(String(item.entryId))),
    )
    .map((item) => String(item.text))
    .join("\n");
  const now = store.now();
  const prefix = bytes.subarray(0, verifiedPrefixSize);

  store.transaction(() => {
    store.run("DELETE FROM session_entries WHERE session_id=?", sessionId);
    store.run("DELETE FROM session_search WHERE session_id=?", sessionId);
    for (const [index, item] of items.entries()) {
      store.run(
        "INSERT INTO session_entries(session_id,entry_id,source_order,item_json,digest) VALUES(?,?,?,?,?)",
        sessionId,
        String(item.entryId),
        index,
        JSON.stringify(item),
        digest(JSON.stringify(item)),
      );
    }
    if (searchable) {
      store.run("INSERT INTO session_search(session_id,text) VALUES(?,?)", sessionId, searchable);
    }
    store.run(
      "INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)",
      `projection:identity:${sessionId}`,
      identity,
    );
    store.run(
      "UPDATE sessions SET availability=?,name=?,updated_at=?,last_summary=?,source_byte_size=?,source_digest=?,verified_prefix_size=?,verified_prefix_digest=?,projection_parser_version=?,projection_generation=projection_generation+1 WHERE session_id=?",
      health,
      name ?? (searchable.slice(0, 80) || "New session"),
      now,
      searchable.slice(0, 1000),
      bytes.length,
      digest(bytes),
      verifiedPrefixSize,
      digest(prefix),
      PROJECTION_PARSER_VERSION,
      sessionId,
    );
  });

  return {
    health,
    items,
    ...(name ? { name } : {}),
    summary: searchable.slice(0, 1000),
  };
}

function markUnavailable(
  store: Store,
  sessionId: string,
  availability: "quarantined" | "unavailable",
): void {
  store.run(
    "UPDATE sessions SET availability=?,updated_at=? WHERE session_id=?",
    availability,
    store.now(),
    sessionId,
  );
}

function normalize(entry: Record<string, any>): Record<string, unknown> | undefined {
  const createdAt = iso(entry.timestamp);
  if (entry.type === "message") {
    const role = entry.message?.role;
    if (role === "toolResult") {
      return {
        entryId: entry.id,
        createdAt,
        kind: "toolResult",
        callId: String(entry.message.toolCallId ?? ""),
        status: entry.message.isError ? "error" : "success",
        text: "",
      };
    }
    if (role !== "user" && role !== "assistant") {
      return unsupported(entry, "message", createdAt);
    }
    const content = entry.message.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .filter((block: any) => block?.type === "text")
              .map((block: any) => String(block.text))
              .join("")
          : "";
    return { entryId: entry.id, createdAt, kind: "message", role, text };
  }
  if (entry.type === "model_change") {
    return {
      entryId: entry.id,
      createdAt,
      kind: "modelChange",
      modelId: `${entry.provider}/${entry.modelId}`,
    };
  }
  if (entry.type === "compaction") {
    return {
      entryId: entry.id,
      createdAt,
      kind: "compaction",
      summary: typeof entry.summary === "string" ? entry.summary : "",
    };
  }
  if (entry.type === "session_info") return undefined;
  return unsupported(entry, String(entry.type).slice(0, 80), createdAt);
}

function unsupported(
  entry: Record<string, any>,
  sourceType: string,
  createdAt: string,
): Record<string, unknown> {
  return {
    entryId: entry.id,
    createdAt,
    kind: "unsupported",
    sourceType,
    safeLabel: "Unsupported Pi entry",
  };
}
