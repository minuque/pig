import { describe, expect, it } from "vitest"
import {
  toolCommand,
  toolWorkingDirectory,
} from "@features/transcript-view/lib/transcript-format.js"
import { readToolPreview } from "@features/transcript-view/lib/tool-presentation.js"

describe("tool result presentation", () => {
  it("Read 结果按读取范围显示真实行号，截断通知不混入代码", () => {
    const code = Array.from({ length: 68 }, (_, index) => `const line${index + 230} = true`).join(
      "\n",
    )
    const input = { path: "G:\\project\\lib\\index.js", offset: 230, limit: 68 }
    const preview = readToolPreview(
      input,
      `${code}\n\n[Showing lines 230-297 of 400 (50.0KB limit). Use offset=298 to continue.]`,
    )
    expect(preview.code).toBe(code)
    expect(preview.lines).toHaveLength(68)
    expect(preview.startLine).toBe(230)
    expect(preview.totalLines).toBe(400)
    expect(preview.language).toBe("javascript")
    expect(
      readToolPreview(input, `${code}\n\n[103 more lines in file. Use offset=298 to continue.]`)
        .totalLines,
    ).toBe(400)
    expect(readToolPreview(input, code).totalLines).toBeNull()
  })

  it("终端卡直接使用命令和工作目录字段，复制内容不取描述", () => {
    const command = `Select-String -Path 'C:\\project\\${"long-directory/".repeat(20)}index.js' -Pattern 'alias'`
    const input = { command, description: "Find aliases unit open call", cwd: "C:\\Temp\\tmp" }
    expect(toolCommand(input)).toBe(command)
    expect(toolWorkingDirectory(input)).toBe("C:\\Temp\\tmp")
  })
})
