import { ref } from "vue"
import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  getMcpScope: vi.fn(),
  getMcpProbes: vi.fn(),
  patchMcpServer: vi.fn(),
  deleteMcpServer: vi.fn(),
  saveMcpServer: vi.fn(),
  probeMcp: vi.fn(),
  logoutMcp: vi.fn(),
  getSkillScope: vi.fn(),
  setSkillEnabled: vi.fn(),
  writeSkill: vi.fn(),
  deleteSkill: vi.fn(),
  createSkill: vi.fn(),
  readSkill: vi.fn(),
}))
const toast = vi.hoisted(() => ({ toastStatus: vi.fn() }))

vi.mock("@client/agent-config.js", () => api)

vi.mock("@pig/ui/toast", () => toast)

const server = {
  name: "fs",
  transport: "stdio" as const,
  enabled: true,
  exposure: "codemode" as const,
  override: false,
  config: { command: "npx" },
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getMcpScope.mockResolvedValue({
    file: "mcp.json",
    servers: [server],
    inherited: [],
    invalid: [],
  })
  api.getMcpProbes.mockResolvedValue({ probes: {} })
  api.getSkillScope.mockResolvedValue({ roots: [], skills: [], inherited: [], diagnostics: [] })
})

describe("设置写入的反馈", () => {
  it("MCP 开关写入失败时写入就地错误，成功时提示新会话生效", async () => {
    const { useMcp } = await import("@features/settings/hooks/use-mcp.js")
    const state = useMcp(ref("global"))

    api.patchMcpServer.mockRejectedValueOnce(new Error("mcp.json 无法解析"))
    await state.setEnabled(server, false)
    expect(state.error.value).toBeTruthy()
    expect(toast.toastStatus).not.toHaveBeenCalled()

    api.patchMcpServer.mockResolvedValueOnce(undefined)
    await state.setEnabled(server, false)
    expect(state.error.value).toBeUndefined()
    expect(toast.toastStatus).toHaveBeenLastCalledWith(expect.any(String), { tone: "success" })
  })

  it("Skill 保存失败时写入就地错误并抛给调用方，不弹 toast", async () => {
    const { useSkills } = await import("@features/settings/hooks/use-skills.js")
    const state = useSkills(ref("global"))

    api.writeSkill.mockRejectedValueOnce(new Error("磁盘只读"))

    await expect(state.write("a/SKILL.md", "x")).rejects.toThrow()
    expect(state.error.value).toBeTruthy()
    expect(toast.toastStatus).not.toHaveBeenCalled()
  })

  it("Skill 的 YAML 写错时返回原因，不提示已保存", async () => {
    const { useSkills } = await import("@features/settings/hooks/use-skills.js")
    const state = useSkills(ref("global"))

    toast.toastStatus.mockClear()
    api.writeSkill.mockResolvedValueOnce({ ok: false, error: "bad yaml" })

    await expect(state.write("a/SKILL.md", "x")).resolves.toBe("bad yaml")
    expect(toast.toastStatus).not.toHaveBeenCalled()
  })
})
