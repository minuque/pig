import { afterEach, describe, expect, it, vi } from "vitest"
import { PlatformRequestError } from "@client/http.js"
import { stageAttachment } from "@client/platform.js"
import {
  MAX_COMPOSER_ATTACHMENTS,
  clipboardFiles,
  useComposerAttachments,
} from "@features/composer/hooks/use-composer-attachments.js"

vi.mock("@client/platform.js", () => ({ stageAttachment: vi.fn() }))

function file(name: string, type: string, size = 4): File {
  const created = new File([new Uint8Array(1)], name, { type })

  Object.defineProperty(created, "size", { value: size })
  return created
}

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

const stage = vi.mocked(stageAttachment)

afterEach(() => {
  vi.restoreAllMocks()
  stage.mockReset()
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

  it("提示能手动关掉", () => {
    const { error, addFiles, dismissError } = useComposerAttachments()

    addFiles([file("big.png", "image/png", 4 * 1024 * 1024)])
    expect(error.value).not.toBe("")
    dismissError()
    expect(error.value).toBe("")
  })

  it("发送批次回写每项进度与状态，已上传的项记进 staged 供跳过", () => {
    const { files, status, progress, errors, addFiles, consumeForSend } = useComposerAttachments()

    addFiles([file("note.md", "text/markdown")])
    const id = files.value[0]!.id
    const batch = consumeForSend()

    expect(batch?.staged).toEqual([])
    batch?.reportProgress?.(id, 40)
    expect(status.value[id]).toBe("uploading")
    expect(progress.value[id]).toBe(40)

    batch?.reportProgress?.(id, 100)
    expect(status.value[id]).toBe("ready")
    expect(progress.value[id]).toBe(100)
    expect(consumeForSend()?.staged).toEqual([id])

    batch?.reportProgress?.(id, undefined)
    expect(status.value[id]).toBeUndefined()
    expect(progress.value[id]).toBeUndefined()

    batch?.reportError?.(id, "上传失败")
    expect(status.value[id]).toBe("error")
    expect(errors.value[id]).toBe("上传失败")
  })

  it("失败项单独重试只重传这一项，成功后进 ready", async () => {
    const { files, status, addFiles, consumeForSend, retryItem } = useComposerAttachments()

    addFiles([file("note.md", "text/markdown"), file("other.md", "text/markdown")])
    const [first, second] = files.value
    const batch = consumeForSend()

    batch?.reportError?.(first!.id, "上传失败")
    expect(status.value[first!.id]).toBe("error")

    let release!: (id: string) => void

    stage.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          release = resolve
        }),
    )

    retryItem(first!.id)
    expect(stage).toHaveBeenCalledTimes(1)
    expect(stage.mock.calls[0]?.[1]).toBe(first!.file)
    expect(status.value[first!.id]).toBe("uploading")

    release("staged-1")
    await vi.waitFor(() => expect(status.value[first!.id]).toBe("ready"))
    expect(status.value[second!.id]).toBeUndefined()
  })

  it("重试失败留下每项错误，已完成的项不再重传", async () => {
    const { files, status, errors, addFiles, consumeForSend, retryItem } = useComposerAttachments()

    addFiles([file("note.md", "text/markdown")])
    const id = files.value[0]!.id
    const batch = consumeForSend()

    batch?.reportProgress?.(id, 100)
    retryItem(id)
    expect(stage).not.toHaveBeenCalled()
    expect(status.value[id]).toBe("ready")

    batch?.reportError?.(id, "上传失败")
    stage.mockRejectedValueOnce(new PlatformRequestError("PAYLOAD_TOO_LARGE", "req-1"))
    retryItem(id)

    await vi.waitFor(() => expect(stage).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(status.value[id]).toBe("error"))
    expect(errors.value[id]).toContain("PAYLOAD_TOO_LARGE")
  })

  it("删除附件同时清掉它的上传状态", () => {
    const { files, status, addFiles, consumeForSend, remove } = useComposerAttachments()

    addFiles([file("note.md", "text/markdown")])
    const id = files.value[0]!.id

    consumeForSend()?.reportProgress?.(id, 30)
    expect(status.value[id]).toBe("uploading")

    remove(id)
    expect(files.value).toEqual([])
    expect(status.value[id]).toBeUndefined()
  })

  it("多文件发送失败后批次号不变，重试时只补传没传完的那几个", () => {
    const { files, addFiles, consumeForSend } = useComposerAttachments()

    addFiles([file("a.md", "text/markdown"), file("b.md", "text/markdown")])
    const [first, second] = files.value
    const batch = consumeForSend()

    expect(batch?.batch).toBeDefined()
    batch?.reportProgress?.(first!.id, 100)

    const retry = consumeForSend()

    expect(retry?.batch).toBe(batch?.batch)
    expect(retry?.staged).toEqual([first!.id])
    expect(retry?.staged).not.toContain(second!.id)
  })

  it("批次被丢弃后已上传的项退回未上传，失败项的错误照旧保留", () => {
    const { files, status, errors, addFiles, consumeForSend, revertStaged } =
      useComposerAttachments()

    addFiles([file("a.md", "text/markdown"), file("b.md", "text/markdown")])
    const [first, second] = files.value
    const batch = consumeForSend()!

    batch.reportProgress?.(first!.id, 100)
    batch.reportError?.(second!.id, "上传失败")
    revertStaged(batch)

    expect(status.value[first!.id]).toBeUndefined()
    expect(status.value[second!.id]).toBe("error")
    expect(errors.value[second!.id]).toBe("上传失败")
    expect(batch.staged).toEqual([])
  })

  it("发出后清空输入卡但仍保留预览地址，成功才回收", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, addFiles, consumeForSend, detach, settle } = useComposerAttachments()

    addFiles([file("shot.png", "image/png")])
    const batch = consumeForSend()!

    detach(batch)
    expect(files.value).toEqual([])
    expect(revoke).not.toHaveBeenCalled()

    settle(batch)
    expect(revoke).toHaveBeenCalledWith("blob:1")
  })

  it("送出后失败时附件回到输入卡，保留原顺序且不回收地址", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
    const { files, status, addFiles, consumeForSend, detach, restore } = useComposerAttachments()

    addFiles([file("shot.png", "image/png"), file("note.md", "text/markdown")])
    const batch = consumeForSend()!

    batch.reportProgress?.(batch.files[0]!.id, 100)
    detach(batch)
    addFiles([file("later.md", "text/markdown")])
    restore(batch)

    expect(files.value.map((item) => item.name)).toEqual(["shot.png", "note.md", "later.md"])
    expect(status.value[batch.files[0]!.id]).toBeUndefined()
    expect(revoke).not.toHaveBeenCalled()
  })
})
