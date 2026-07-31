import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

const { api, route } = vi.hoisted(() => ({
  api: vi.fn(),
  route: { params: { sessionId: "same" } },
}));
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn(async () => undefined) }),
}));
vi.mock("../src/api/index.js", () => ({
  api,
  errorMessage: () => "error",
}));

import type { WorkspaceDto } from "../src/api/index.js";
import { useSessions } from "../src/features/sessions/use-sessions.js";

describe("useSessions transcript identity", () => {
  it("does not commit a delayed response to the same session ID in another workspace", async () => {
    let resolve!: (value: { transcript: Array<{ content: string }> }) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    api.mockImplementation(() => new Promise(() => undefined));
    const workspace = ref<WorkspaceDto>({ id: "a", name: "A", canonicalPath: "/a" });
    const sessions = useSessions(workspace);
    sessions.sessions.value = [
      { id: "same", workspaceId: "a", status: "available", updatedAt: "now" },
    ];
    const pending = sessions.loadTranscript();

    workspace.value = { id: "b", name: "B", canonicalPath: "/b" };
    sessions.sessions.value = [
      { id: "same", workspaceId: "b", status: "available", updatedAt: "now" },
    ];
    resolve({ transcript: [{ content: "wrong workspace" }] });
    await pending;

    expect(sessions.transcript.value).toEqual([]);
  });
});
