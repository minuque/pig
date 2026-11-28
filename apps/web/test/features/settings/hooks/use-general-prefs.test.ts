import { beforeEach, describe, expect, it, vi } from "vitest"
import type { UserPreferences, UserPreferencesPatch } from "@/types/common-type.js"

const api = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  patchPreferences: vi.fn(),
}))

vi.mock("@client/platform.js", () => api)

const DEFAULTS: UserPreferences = {
  theme: "auto",
  palette: "pig",
  codeTheme: "github",
  uiFont: "",
  codeFont: "",
  codeSize: 13,
  contrast: 100,
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

  const [prefs, general] = await Promise.all([
    import("@client/preferences.js"),
    import("@features/settings/hooks/use-general-prefs.js"),
  ])
  return { ...prefs, ...general }
}

beforeEach(() => {
  localStorage.clear()
  api.getPreferences.mockReset()
  api.patchPreferences.mockReset()
})

describe("useGeneralPrefs", () => {
  it("输入尾随空格保留输入态且不重复写盘，远端变更同步更新", async () => {
    let server: UserPreferences = { ...DEFAULTS, userName: "John" }

    api.getPreferences.mockResolvedValue({ preferences: server, exists: true })
    api.patchPreferences.mockImplementation(async (patch: UserPreferencesPatch) => {
      server = { ...server, ...patch }
      return server
    })

    const { applyRemotePreferences, hydratePreferences, useGeneralPrefs } = await load()

    await hydratePreferences()

    const { userName, setUserName } = useGeneralPrefs()

    expect(userName.value).toBe("John")

    setUserName("John ")
    expect(userName.value).toBe("John ")
    expect(api.patchPreferences).not.toHaveBeenCalled()

    setUserName("John D")
    await vi.waitFor(() => expect(api.patchPreferences).toHaveBeenCalledTimes(1))

    expect(api.patchPreferences).toHaveBeenCalledWith({ userName: "John D" })
    expect(userName.value).toBe("John D")

    applyRemotePreferences({ ...server, userName: "Alice" })
    expect(userName.value).toBe("Alice")
  })
})
