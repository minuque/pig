import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Store } from "../db/store.js";
export type Projection = {
  health: "healthy" | "dirty_tail" | "quarantined" | "unavailable";
  items: Array<Record<string, unknown>>;
  name?: string;
  summary?: string;
};
const iso = (v: unknown) => (typeof v === "string" ? v : new Date().toISOString());
export async function projectSession(
  store: Store,
  sessionId: string,
  file: string,
): Promise<Projection> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    store.run(
      "UPDATE sessions SET availability=?,updated_at=? WHERE session_id=?",
      "unavailable",
      new Date().toISOString(),
      sessionId,
    );
    return { health: "unavailable", items: [] };
  }
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  let health: Projection["health"] = "healthy";
  const items: Record<string, unknown>[] = [];
  const ids = new Set<string>();
  let header: Record<string, unknown> | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    let x: Record<string, any>;
    try {
      x = JSON.parse(line);
    } catch {
      if (i === lines.length - 1) {
        health = "dirty_tail";
        break;
      }
      store.run(
        "UPDATE sessions SET availability=?,updated_at=? WHERE session_id=?",
        "quarantined",
        new Date().toISOString(),
        sessionId,
      );
      return { health: "quarantined", items };
    }
    if (i === 0) {
      if (x.type !== "session" || typeof x.id !== "string" || typeof x.cwd !== "string") {
        store.run(
          "UPDATE sessions SET availability=?,updated_at=? WHERE session_id=?",
          "quarantined",
          new Date().toISOString(),
          sessionId,
        );
        return { health: "quarantined", items };
      }
      const identity = createHash("sha256")
        .update(JSON.stringify({ id: x.id, cwd: x.cwd }))
        .digest("hex");
      const previous = store.row<{ value: string }>(
        "SELECT value FROM metadata WHERE key=?",
        `projection:identity:${sessionId}`,
      );
      if (previous && previous.value !== identity) {
        store.run(
          "UPDATE sessions SET availability=?,updated_at=? WHERE session_id=?",
          "quarantined",
          new Date().toISOString(),
          sessionId,
        );
        return { health: "quarantined", items: [] };
      }
      store.run(
        "INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)",
        `projection:identity:${sessionId}`,
        identity,
      );
      header = x;
      continue;
    }
    if (typeof x.id !== "string" || ids.has(x.id)) {
      store.run(
        "UPDATE sessions SET availability=?,updated_at=? WHERE session_id=?",
        "quarantined",
        new Date().toISOString(),
        sessionId,
      );
      return { health: "quarantined", items };
    }
    ids.add(x.id);
    const item = normalize(x);
    if (item) items.push(item);
  }
  const name = lines
    .map((l) => {
      try {
        const x = JSON.parse(l);
        return x.type === "session_info" && typeof x.name === "string" ? x.name : undefined;
      } catch {
        return undefined;
      }
    })
    .filter(Boolean)
    .at(-1) as string | undefined;
  const rawEntries = lines.slice(1).flatMap((line) => {
    try {
      return [JSON.parse(line) as Record<string, any>];
    } catch {
      return [];
    }
  });
  const byId = new Map(rawEntries.filter((x) => typeof x.id === "string").map((x) => [x.id, x]));
  const hasParentLinks = rawEntries.some((x) => typeof x.parentId === "string");
  const activeRaw = new Set<string>();
  if (hasParentLinks) {
    let leaf = [...rawEntries].reverse().find((x) => typeof x.id === "string");
    while (leaf && typeof leaf.id === "string" && !activeRaw.has(leaf.id)) {
      activeRaw.add(leaf.id);
      leaf = typeof leaf.parentId === "string" ? byId.get(leaf.parentId) : undefined;
    }
  }
  const user = items
    .filter(
      (x) =>
        x.kind === "message" &&
        (x.role === "user" || x.role === "assistant") &&
        (!hasParentLinks || activeRaw.has(String(x.entryId))),
    )
    .map((x) => String(x.text))
    .join("\n");
  store.transaction(() => {
    store.run("DELETE FROM session_entries WHERE session_id=?", sessionId);
    store.run("DELETE FROM session_search WHERE session_id=?", sessionId);
    for (const [i, item] of items.entries()) {
      const entry = String(item.entryId);
      const digest = createHash("sha256").update(JSON.stringify(item)).digest("hex");
      store.run(
        "INSERT INTO session_entries(session_id,entry_id,source_order,item_json,digest) VALUES(?,?,?,?,?)",
        sessionId,
        entry,
        i,
        JSON.stringify(item),
        digest,
      );
    }
    if (user) store.run("INSERT INTO session_search(session_id,text) VALUES(?,?)", sessionId, user);
    store.run(
      "UPDATE sessions SET availability=?,name=?,updated_at=?,last_summary=? WHERE session_id=?",
      health,
      name ?? (user.slice(0, 80) || "New session"),
      new Date().toISOString(),
      user.slice(0, 1000),
      sessionId,
    );
  });
  return {
    health,
    items,
    ...(name ? { name } : {}),
    summary: user.slice(0, 1000),
  };
}
function normalize(x: Record<string, any>): Record<string, unknown> | undefined {
  const createdAt = iso(x.timestamp);
  if (x.type === "message") {
    const role = x.message?.role;
    if (role === "toolResult")
      return {
        entryId: x.id,
        createdAt,
        kind: "toolResult",
        callId: String(x.message.toolCallId ?? ""),
        status: x.message.isError ? "error" : "success",
        text: "",
      };
    if (role !== "user" && role !== "assistant")
      return {
        entryId: x.id,
        createdAt,
        kind: "unsupported",
        sourceType: "message",
        safeLabel: "Unsupported Pi entry",
      };
    const c = x.message.content;
    const text =
      typeof c === "string"
        ? c
        : Array.isArray(c)
          ? c
              .filter((b: any) => b?.type === "text")
              .map((b: any) => String(b.text))
              .join("")
          : "";
    return { entryId: x.id, createdAt, kind: "message", role, text };
  }
  if (x.type === "model_change")
    return {
      entryId: x.id,
      createdAt,
      kind: "modelChange",
      modelId: `${x.provider}/${x.modelId}`,
    };
  if (x.type === "compaction")
    return {
      entryId: x.id,
      createdAt,
      kind: "compaction",
      summary: typeof x.summary === "string" ? x.summary : "",
    };
  if (x.type === "session_info") return undefined;
  return {
    entryId: x.id,
    createdAt,
    kind: "unsupported",
    sourceType: String(x.type).slice(0, 80),
    safeLabel: "Unsupported Pi entry",
  };
}
