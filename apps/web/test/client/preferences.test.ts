import { beforeEach, describe, expect, it, vi } from "vitest"
import type { UserPreferences, UserPreferencesPatch } from "@/types/common-type.js"

const api = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  patchPreferences: vi.fn(),
}))

vi.mock("@client/platform.js", () => api)

const DEFAULTS: UserPreferences = {
  theme: "auto",
  themePreset: "linear",
  welcomeField: "mask",
  uiFont: "",
  codeFont: "",
  uiSize: "m",
  codeSize: 13,
  locale: "zh-CN",
  chatWidth: "comfortable",
  notify: true,
  userName: "",
  clickSound: true,
  favoriteModels: [],
  railLayout: { closed: [], hidden: [] },
}

async function load() {
  vi.resetModules()
  return import("@client/preferences.js")
}

beforeEach(() => {
  localStorage.clear()
  api.getPreferences.mockReset()
  api.patchPreferences.mockReset()
})

describe("preferences 首屏镜像与迁移", () => {
  it("服务端没有文件时把 localStorage 里的旧键一次性迁过去", async () => {
    localStorage.setItem("npg-theme", "dark")
    localStorage.setItem("pig.locale", "en")
    localStorage.setItem("pig.favoriteModels", '["openai/gpt-5","bad","openai/gpt-5"]')
    api.getPreferences.mockResolvedValue({ preferences: DEFAULTS, exists: false })
    api.patchPreferences.mockImplementation(async (patch: UserPreferencesPatch) => ({
      ...DEFAULTS,
      ...patch,
    }))

    const { hydratePreferences, userPreferences } = await load()

    await hydratePreferences()

    expect(api.patchPreferences).toHaveBeenCalledTimes(1)
    expect(api.patchPreferences.mock.calls[0]?.[0]).toEqual({
      theme: "dark",
      locale: "en",
      favoriteModels: ["openai/gpt-5"],
    })
    expect(userPreferences.value.theme).toBe("dark")
    expect(userPreferences.value.favoriteModels).toEqual(["openai/gpt-5"])
  })

  it("localStorage 为空时既不写文件也不发补丁", async () => {
    api.getPreferences.mockResolvedValue({ preferences: DEFAULTS, exists: false })

    const { hydratePreferences } = await load()

    await hydratePreferences()

    expect(api.patchPreferences).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it("localStorage 只有默认值时不抢先迁移建文件", async () => {
    localStorage.setItem("npg-theme", "auto")
    localStorage.setItem("pig.locale", "zh-CN")
    localStorage.setItem("pig.notify", "on")
    localStorage.setItem("pig.favoriteModels", "[]")
    api.getPreferences.mockResolvedValue({ preferences: DEFAULTS, exists: false })

    const { hydratePreferences } = await load()

    await hydratePreferences()

    expect(api.patchPreferences).not.toHaveBeenCalled()
  })

  it("服务端已有文件时以服务端为准覆盖内存与镜像，不反向写服务端", async () => {
    localStorage.setItem("npg-theme", "dark")
    localStorage.setItem("pig.locale", "en")
    const server: UserPreferences = { ...DEFAULTS, theme: "light", uiFont: "Inter" }

    api.getPreferences.mockResolvedValue({ preferences: server, exists: true })

    const { hydratePreferences, userPreferences } = await load()

    await hydratePreferences()

    expect(userPreferences.value).toEqual(server)
    expect(localStorage.getItem("npg-theme")).toBe("light")
    expect(localStorage.getItem("pig.locale")).toBe("zh-CN")
    expect(localStorage.getItem("pig.uiFont")).toBe("Inter")
    expect(api.patchPreferences).not.toHaveBeenCalled()
  })
})

describe("preferences 同步", () => {
  it("远端变更更新内存与全部镜像，且不回发补丁", async () => {
    const { applyRemotePreferences, userPreferences } = await load()

    applyRemotePreferences({
      ...DEFAULTS,
      theme: "dark",
      themePreset: "ocean",
      codeSize: 15,
      notify: false,
      clickSound: false,
      railLayout: { closed: ["tasks"], hidden: ["context"] },
    })

    expect(userPreferences.value.themePreset).toBe("ocean")
    expect(localStorage.getItem("npg-theme")).toBe("dark")
    expect(localStorage.getItem("pig.themePreset")).toBe("ocean")
    expect(localStorage.getItem("pig.codeSize")).toBe("15")
    expect(localStorage.getItem("pig.notify")).toBe("off")
    expect(localStorage.getItem("pig.clickSound")).toBe("off")
    expect(localStorage.getItem("pig.rail.layout")).toBe(
      '{"closed":["tasks"],"hidden":["context"]}',
    )
    expect(api.patchPreferences).not.toHaveBeenCalled()
  })

  it("连续快速修改按序合并发送，在途返回与远端快照不覆盖未发出的本地乐观状态", async () => {
    api.getPreferences.mockResolvedValue({ preferences: DEFAULTS, exists: true })

    const { applyRemotePreferences, hydratePreferences, updatePreferences, userPreferences } =
      await load()

    await hydratePreferences()

    const sent: UserPreferencesPatch[] = []
    let server: UserPreferences = { ...DEFAULTS }
    let release = () => {}

    api.patchPreferences.mockImplementation(async (patch: UserPreferencesPatch) => {
      sent.push(patch)

      if (sent.length === 1) await new Promise<void>((resolve) => (release = resolve))
      server = { ...server, ...patch }
      return server
    })

    updatePreferences({ theme: "dark" })
    updatePreferences({ locale: "en" })

    expect(sent).toEqual([{ theme: "dark" }])
    expect(userPreferences.value.locale).toBe("en")

    applyRemotePreferences({ ...DEFAULTS, themePreset: "paper", locale: "zh-CN" })
    expect(userPreferences.value.themePreset).toBe("paper")
    expect(userPreferences.value.locale).toBe("en")

    release()
    await vi.waitFor(() => expect(sent).toHaveLength(2))

    expect(sent).toEqual([{ theme: "dark" }, { locale: "en" }])
    expect(userPreferences.value.theme).toBe("dark")
    expect(userPreferences.value.locale).toBe("en")
  })
})
