import { afterEach, describe, expect, it, vi } from "vitest"
import {
  MAX_COMPOSER_ATTACHMENTS,
  clipboardFiles,
  useComposerAttachments,
} from "@features/composer/hooks/use-composer-attachments.js"

/** 只改 size 的替身：造 25MB 真字节没必要。 */
function file(name: string, type: string, size = 4): File {
  const created = new File([new Uint8Array(1)], name, { type })

  Object.defineProperty(created, "size", { value: size })
  return created
}

/** 拖拽替身：items 与 files 同源，webkitGetAsEntry 决定是否文件夹。 */
function transfer(files: File[], folders: string[] = []): DataTransfer {
  const entry = (name: string, isDirectory: boolean) => ({
    isDirectory,
    name,
    getAsFile: () => files.find((item) => item.name === name) ?? null,
  })
  const items = [
    ...files.map((item) => ({
      kind: "file",
      getAsFile: () => item,
      webkitGetAsEntry: () => entry(item.name, false),
    })),
    ...folders.map((name) => ({
      kind: "file",
      getAsFile: () => null,
      webkitGetAsEntry: () => entry(name, true),
    })),
  ]
  return { files, items } as unknown as DataTransfer
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useComposerAttachments", () => {
  it("白名单图片走 blob 预览，其余只留文件卡片", () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, addFiles } = useComposerAttachments()

    addFiles([
      file("shot.png", "image/png"),
      file("photo.JPEG", "image/jpeg"),
      file("icon.svg", "image/svg+xml"),
      file("note.md", ""),
    ])

    expect(create).toHaveBeenCalledTimes(2)
    expect(files.value).toHaveLength(4)
    expect(files.value[0]).toMatchObject({
      name: "shot.png",
      mimeType: "image/png",
      size: 4,
      url: "blob:1",
    })
    expect(files.value[1]).toMatchObject({ name: "photo.JPEG", url: "blob:1" })
    expect(files.value[2]).toMatchObject({ name: "icon.svg", mimeType: "image/svg+xml", url: "" })
    expect(files.value[3]).toMatchObject({
      name: "note.md",
      mimeType: "application/octet-stream",
      url: "",
    })
  })

  it("非白名单的 image/* 按普通文件判限，白名单图片才吃 3MB", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, error, addFiles } = useComposerAttachments()

    addFiles([
      file("shot.png", "image/png", 4 * 1024 * 1024),
      file("icon.svg", "image/svg+xml", 4 * 1024 * 1024),
    ])

    expect(files.value.map((item) => item.name)).toEqual(["icon.svg"])
    expect(error.value).toBe("已跳过 shot.png（超过 3MB）")
  })

  it("同名同大小同类型只留一个，跨两次附加也去重", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, addFiles } = useComposerAttachments()
    const shot = file("shot.png", "image/png")

    addFiles([shot, shot])
    addFiles([shot])

    expect(files.value).toHaveLength(1)
  })

  it("超出数量、超出体积的文件跳过并报出文件名与原因", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, error, addFiles } = useComposerAttachments()

    addFiles([
      file("big.png", "image/png", 4 * 1024 * 1024),
      file("big.zip", "application/zip", 26 * 1024 * 1024),
    ])

    expect(files.value).toEqual([])
    expect(error.value).toContain("big.png（超过 3MB）")
    expect(error.value).toContain("big.zip（超过 25MB）")

    const many = Array.from({ length: MAX_COMPOSER_ATTACHMENTS + 2 }, (_, i) =>
      file(`f${i}.txt`, "text/plain"),
    )

    addFiles(many)
    expect(files.value).toHaveLength(MAX_COMPOSER_ATTACHMENTS)
    expect(error.value).toContain("f8.txt（最多 8 个附件）")
  })

  it("上限内正常附加时清掉上一次的错误", () => {
    const { error, addFiles } = useComposerAttachments()

    addFiles([file("big.png", "image/png", 4 * 1024 * 1024)])
    expect(error.value).not.toBe("")
    addFiles([file("ok.png", "image/png")])
    expect(error.value).toBe("")
  })

  it("remove 与 settle 都撤销 blob URL", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, addFiles, remove, consumeForSend, settle } = useComposerAttachments()

    addFiles([file("a.png", "image/png"), file("b.png", "image/png")])
    remove(files.value[0]!.id)
    expect(revoke).toHaveBeenCalledWith("blob:1")
    expect(files.value.map((item) => item.name)).toEqual(["b.png"])
    settle(consumeForSend()!)
    expect(revoke).toHaveBeenCalledTimes(2)
    expect(files.value).toEqual([])
  })

  it("settle 只移走本批文件，发送途中新加的留着", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, addFiles, consumeForSend, settle } = useComposerAttachments()

    addFiles([file("a.png", "image/png")])
    const batch = consumeForSend()!

    addFiles([file("b.png", "image/png")])
    settle(batch)
    expect(files.value.map((item) => item.name)).toEqual(["b.png"])
  })

  it("settle 清的是批次来源的桶，不是当前桶", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, addFiles, consumeForSend, settle, setKey } = useComposerAttachments()

    addFiles([file("a.png", "image/png")])
    const batch = consumeForSend()!

    setKey("sess-new")
    addFiles([file("b.png", "image/png")])
    settle(batch)
    expect(files.value.map((item) => item.name)).toEqual(["b.png"])
    setKey(undefined)
    expect(files.value).toEqual([])
  })

  it("拖入文件夹跳过并提示，文件照常附加", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, error, addDropped } = useComposerAttachments()

    addDropped(transfer([file("a.png", "image/png")], ["docs"]))

    expect(files.value.map((item) => item.name)).toEqual(["a.png"])
    expect(error.value).toBe("已跳过 docs（文件夹不支持）")
  })

  it("剪贴板两路收集按去重键合并", () => {
    const shot = file("shot.png", "image/png")
    const text = file("note.md", "text/markdown")

    expect(clipboardFiles(transfer([shot, text]))).toEqual([shot, text])
    expect(clipboardFiles(null)).toEqual([])
  })

  it("每次 consumeForSend 都换新 batch，settle 后不再返回批次", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { addFiles, consumeForSend, settle } = useComposerAttachments()

    expect(consumeForSend()).toBeUndefined()
    addFiles([file("a.png", "image/png")])
    const first = consumeForSend()
    const second = consumeForSend()

    expect(first?.batch).toMatch(/^[A-Za-z0-9-]{1,64}$/)
    expect(first?.files).toHaveLength(1)
    expect(second?.batch).not.toBe(first?.batch)
    settle(first!)
    expect(consumeForSend()).toBeUndefined()
  })
})
