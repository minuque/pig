import { describe, expect, it } from "vitest"
import { mergeWorkspaceGit } from "@client/gateway-client.js"

describe("mergeWorkspaceGit", () => {
  it("变化按目录合并，null 表示这个目录不再是仓库", () => {
    const merged = mergeWorkspaceGit(
      {
        "/repo/a": { branch: "main", detached: false, worktree: false },
        "/repo/b": { branch: "main", detached: false, worktree: false },
      },
      {
        "/repo/a": { branch: "feat/x", detached: false, worktree: false },
        "/repo/b": null,
        "/repo/c": { branch: "abc1234", detached: true, worktree: true },
      },
    )

    expect(merged).toEqual({
      "/repo/a": { branch: "feat/x", detached: false, worktree: false },
      "/repo/c": { branch: "abc1234", detached: true, worktree: true },
    })
  })
})
