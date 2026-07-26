import { createHash } from "node:crypto";
import type { Store } from "../db/store.js";

/** Deterministic JSON used by every mutating HTTP command. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}

export function safeDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function replayCommand<T>(
  store: Store,
  principalId: string,
  commandId: string,
  payload: unknown,
): T | undefined {
  const row = store.row<{ payload_hash: string; result_json: string }>(
    "SELECT payload_hash,result_json FROM commands WHERE principal_id=? AND command_id=?",
    principalId,
    commandId,
  );
  if (!row) return undefined;
  if (row.payload_hash !== safeDigest(payload))
    throw new Error("command.idempotency_conflict");
  return JSON.parse(row.result_json) as T;
}

export function recordCommand(
  store: Store,
  principalId: string,
  commandId: string,
  payload: unknown,
  result: unknown,
): void {
  store.run(
    "INSERT INTO commands(principal_id,command_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)",
    principalId,
    commandId,
    safeDigest(payload),
    JSON.stringify(result),
    store.now(),
  );
}
