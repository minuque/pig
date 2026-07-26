import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectSession } from "../src/projection/projector.js";
import { addPrincipalWorkspaceSession, openStore, removeTempDir, tempDir } from "./helpers.js";

const cleanups: string[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(removeTempDir));
});

const header = { type: "session", id: "session_source", cwd: "/safe" };
const line = (value: unknown) => JSON.stringify(value);

describe("session projection", () => {
  it("projects partial tails, quarantines interior corruption, and excludes unsafe content from FTS", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(
      source,
      [
        line(header),
        line({ type: "session_info", id: "info_1", name: "Renamed" }),
        line({
          type: "message",
          id: "user_1",
          message: { role: "user", content: "visible user text" },
        }),
        line({
          type: "message",
          id: "assistant_1",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "visible assistant text" }],
          },
        }),
        line({
          type: "message",
          id: "tool_1",
          message: {
            role: "toolResult",
            toolCallId: "secret-call",
            content: "secret tool payload",
          },
        }),
        line({
          type: "future",
          id: "future_1",
          payload: "do not index this canary",
        }),
        '{"type":"message"',
      ].join("\n"),
    );
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    try {
      const dirty = await projectSession(store, "session_1", source);
      expect(dirty.health).toBe("dirty_tail");
      expect(dirty.name).toBe("Renamed");
      expect(dirty.items.map((x) => x.kind)).toEqual([
        "message",
        "message",
        "toolResult",
        "unsupported",
      ]);
      const indexed = store.all<{ text: string }>(
        "SELECT text FROM session_search WHERE session_id=?",
        "session_1",
      );
      expect(indexed).toHaveLength(1);
      expect(indexed[0]!.text).toContain("visible assistant text");
      expect(indexed[0]!.text).not.toContain("secret tool payload");
      expect(indexed[0]!.text).not.toContain("do not index this canary");
      expect(
        store.row<{ availability: string }>(
          "SELECT availability FROM sessions WHERE session_id='session_1'",
        )?.availability,
      ).toBe("dirty_tail");

      await writeFile(
        source,
        [
          line(header),
          "not-json",
          line({
            type: "message",
            id: "later",
            message: { role: "user", content: "later" },
          }),
        ].join("\n"),
      );
      const quarantined = await projectSession(store, "session_1", source);
      expect(quarantined.health).toBe("quarantined");
      expect(
        store.row<{ availability: string }>(
          "SELECT availability FROM sessions WHERE session_id='session_1'",
        )?.availability,
      ).toBe("quarantined");
      expect(
        store.row<{ count: number }>(
          "SELECT count(*) AS count FROM session_entries WHERE session_id='session_1'",
        )?.count,
      ).toBe(4);
    } finally {
      db.close();
    }
  });

  it("marks a missing source unavailable", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, join(dir, "missing.jsonl"));
    try {
      expect((await projectSession(store, "session_1", join(dir, "missing.jsonl"))).health).toBe(
        "unavailable",
      );
      expect(
        store.row<{ availability: string }>(
          "SELECT availability FROM sessions WHERE session_id='session_1'",
        )?.availability,
      ).toBe("unavailable");
    } finally {
      db.close();
    }
  });

  it("publishes append shadows atomically and preserves the last generation on divergence", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    const first = line({
      type: "message",
      id: "first",
      message: { role: "user", content: "first searchable" },
    });
    const second = line({
      type: "message",
      id: "second",
      message: { role: "assistant", content: "second searchable" },
    });
    const base = `${line(header)}\n${first}\n`;
    await writeFile(source, base);
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    try {
      await projectSession(store, "session_1", source);
      expect(
        store.row<{ projection_generation: number }>(
          "SELECT projection_generation FROM sessions WHERE session_id='session_1'",
        )?.projection_generation,
      ).toBe(1);

      await writeFile(source, `${base}{\"type\":\"message\",\"id\":\"second\"`);
      expect((await projectSession(store, "session_1", source)).health).toBe("dirty_tail");
      expect(
        store.row<{ projection_generation: number }>(
          "SELECT projection_generation FROM sessions WHERE session_id='session_1'",
        )?.projection_generation,
      ).toBe(2);

      await writeFile(source, `${base}${second}\n`);
      expect((await projectSession(store, "session_1", source)).items).toHaveLength(2);
      const accepted = store.row<{
        projection_generation: number;
        text: string;
      }>(
        "SELECT s.projection_generation,f.text FROM sessions s JOIN session_search f ON f.session_id=s.session_id WHERE s.session_id='session_1'",
      );
      expect(accepted).toMatchObject({
        projection_generation: 3,
        text: expect.stringContaining("second searchable"),
      });

      await writeFile(source, base);
      expect((await projectSession(store, "session_1", source)).health).toBe("quarantined");
      expect(
        store.row<{ projection_generation: number }>(
          "SELECT projection_generation FROM sessions WHERE session_id='session_1'",
        )?.projection_generation,
      ).toBe(3);
      expect(
        store.row<{ text: string }>("SELECT text FROM session_search WHERE session_id='session_1'")
          ?.text,
      ).toContain("second searchable");

      await rm(source);
      expect((await projectSession(store, "session_1", source)).health).toBe("unavailable");
      expect(
        store.row<{ projection_generation: number }>(
          "SELECT projection_generation FROM sessions WHERE session_id='session_1'",
        )?.projection_generation,
      ).toBe(3);
    } finally {
      db.close();
    }
  });
});
