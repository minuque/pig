import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionArchives, SessionArchivesPatch } from "@/types/common-type.js"

const api = vi.hoisted(() => ({
  getSessionArchives: vi.fn(),
  patchSessionArchives: vi.fn(),
}))

vi.mock("@client/platform.js", () => api)

async function load() {
  vi.resetModules()
  return import("@client/session-archives.js")
}

beforeEach(() => {
  api.getSessionArchives.mockReset()
  api.patchSessionArchives.mockReset()
})

describe("session-archives 客户端同步与乐观回滚", () => {
  it("hydrateSessionArchives 从服务端加载已归档映射", async () => {
    api.getSessionArchives.mockResolvedValue({
      archives: { s1: 1000, s2: 2000 },
      exists: true,
    })

    const { hydrateSessionArchives, sessionArchives, archivedSessionIds } = await load()

    await hydrateSessionArchives()

    expect(sessionArchives.value).toEqual({ s1: 1000, s2: 2000 })
    expect([...archivedSessionIds.value]).toEqual(["s1", "s2"])
  })

  it("archiveSessions 与 unarchiveSessions 乐观更新并在请求失败时回滚", async () => {
    api.getSessionArchives.mockResolvedValue({ archives: { s1: 1000 }, exists: true })

    const { hydrateSessionArchives, archiveSessions, unarchiveSessions, sessionArchives } =
      await load()

    await hydrateSessionArchives()

    let failNext = true
    api.patchSessionArchives.mockImplementation(async (patch: SessionArchivesPatch) => {
      if (failNext) throw new Error("network down")
      return patch.archive ? { s1: 1000, s2: 5000 } : { s1: 1000 }
    })

    await expect(archiveSessions(["s2"])).rejects.toThrow("network down")
    expect(sessionArchives.value).toEqual({ s1: 1000 })

    failNext = false
    await archiveSessions(["s2"])
    expect(sessionArchives.value).toEqual({ s1: 1000, s2: 5000 })

    api.patchSessionArchives.mockRejectedValueOnce(new Error("boom"))
    await expect(unarchiveSessions(["s1"])).rejects.toThrow("boom")
    expect(sessionArchives.value).toEqual({ s1: 1000, s2: 5000 })
  })

  it("在途修改期间忽略旧的远端推送，全部完成后恢复远端同步", async () => {
    api.getSessionArchives.mockResolvedValue({ archives: {}, exists: true })

    const { hydrateSessionArchives, archiveSessions, applyRemoteSessionArchives, sessionArchives } =
      await load()

    await hydrateSessionArchives()

    let release = () => {}
    let server: SessionArchives = {}

    api.patchSessionArchives.mockImplementation(async (patch: SessionArchivesPatch) => {
      await new Promise<void>((resolve) => {
        release = resolve
      })

      for (const id of patch.archive ?? []) server[id] = 3000
      return { ...server }
    })

    const pending = archiveSessions(["s1"])

    expect(sessionArchives.value.s1).toBeTypeOf("number")

    await vi.waitFor(() => expect(api.patchSessionArchives).toHaveBeenCalledTimes(1))
    applyRemoteSessionArchives({})
    expect(sessionArchives.value.s1).toBeTypeOf("number")

    release()
    await pending

    expect(sessionArchives.value).toEqual({ s1: 3000 })
    applyRemoteSessionArchives({ s1: 3000, s2: 4000 })
    expect(sessionArchives.value).toEqual({ s1: 3000, s2: 4000 })
  })

  it("在途修改期间收到远端推送，若本地请求失败回滚则保留远端最新快照", async () => {
    api.getSessionArchives.mockResolvedValue({ archives: {}, exists: true })

    const { hydrateSessionArchives, archiveSessions, applyRemoteSessionArchives, sessionArchives } =
      await load()

    await hydrateSessionArchives()

    let rejectPatch!: (error: Error) => void

    api.patchSessionArchives.mockImplementation(
      () =>
        new Promise<SessionArchives>((_resolve, reject) => {
          rejectPatch = reject
        }),
    )

    const pending = archiveSessions(["s1"])

    await vi.waitFor(() => expect(api.patchSessionArchives).toHaveBeenCalledTimes(1))
    applyRemoteSessionArchives({ s9: 9000 })
    expect(sessionArchives.value.s1).toBeTypeOf("number")

    rejectPatch(new Error("boom"))
    await expect(pending).rejects.toThrow("boom")
    expect(sessionArchives.value).toEqual({ s9: 9000 })
  })
})
