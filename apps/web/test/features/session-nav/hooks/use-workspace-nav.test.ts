import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readonly, ref } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"

const { platformRequestMock } = vi.hoisted(() => ({
  platformRequestMock: vi.fn(),
}))

vi.mock("@client/http.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@client/http.js")>()
  return { ...actual, platformRequest: platformRequestMock }
})

import {
  SIDEBAR_SORT_KEY,
  SIDEBAR_VIEW_KEY,
  useWorkspaceNav,
} from "@features/session-nav/hooks/use-workspace-nav.js"

const store = new Map<string, string>()

function localWorkspaces(paths: string[]) {
  const workspaces = ref(paths)
  const lastCwd = ref<string | undefined>(paths[0])
  return {
    workspaces: readonly(workspaces),
    lastCwd: readonly(lastCwd),
    add: () => undefined,
    remove: () => undefined,
    selectCwd: () => undefined,
  }
}

function admin() {
  return {
    sessionId: ref(undefined),
    router: { replace: vi.fn() } as never,
    refreshSessions: vi.fn(async () => undefined),
  }
}

describe("useWorkspaceNav grouping", () => {
  beforeEach(() => {
    store.clear()
    platformRequestMock.mockReset()
    platformRequestMock.mockResolvedValue({ cards: [] })
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("默认按工作区分组、手动排序，切换后写入并在下次启动读回", () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "/a" }])
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), admin())
    expect(nav.view.value).toBe("grouped")
    expect(nav.sort.value).toBe("manual")
    expect(nav.grouping.value).toBe("project")

    nav.setView("flat")
    nav.setSort("recent")
    expect(nav.grouping.value).toBe("updated")
    expect(store.get(SIDEBAR_VIEW_KEY)).toBe("flat")
    expect(store.get(SIDEBAR_SORT_KEY)).toBe("recent")

    const restored = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), admin())
    expect(restored.view.value).toBe("flat")
    expect(restored.sort.value).toBe("recent")
  })
})
