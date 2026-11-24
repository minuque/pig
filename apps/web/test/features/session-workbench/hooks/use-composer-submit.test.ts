import { afterEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import type { ComposerAttachmentBatch, SendAttachmentsHooks } from "@/types/attachment-type.js"
import { useComposerAttachments } from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerDraftApi } from "@features/composer/hooks/use-composer-draft.js"
import type { ComposerQueueApi, QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"

const notify = vi.fn()

vi.mock("@pig/ui/toast", () => ({ notify }))

const { useComposerSubmit } =
  await import("@features/session-workbench/hooks/use-composer-submit.js")

function file(name: string, type = "text/markdown"): File {
  return new File([new Uint8Array(1)], name, { type })
}

const draft = {
  editingQueueId: ref<string | null>(null),
  pushHistory: () => {},
  historyPrev: () => {},
  historyNext: () => {},
  beginQueueEdit: () => {},
  commitQueueEdit: () => undefined,
  cancelQueueEdit: () => {},
} as unknown as ComposerDraftApi

function setup(
  submit: (
    text: string,
    cwd: string | undefined,
    batch: ComposerAttachmentBatch | undefined,
    hooks: SendAttachmentsHooks | undefined,
    options?: { preserveDraft?: boolean },
  ) => Promise<boolean>,
  isRunning = false,
) {
  const attachments = useComposerAttachments()
  const prompt = ref("")
  const editingQueueId = ref<string | null>(null)
  const cancelQueueEdit = vi.fn(() => {
    editingQueueId.value = null
  })
  const remove = vi.fn()
  const queue = {
    items: ref([]),
    enqueue: () => {},
    update: () => {},
    remove,
  } as unknown as ComposerQueueApi
  const steer = vi.fn(() => Promise.resolve(true))
  const composer = useComposerSubmit({
    sessionId: () => "s1",
    welcomeCwd: () => undefined,
    running: () => isRunning,
    prompt,
    draft: { ...draft, editingQueueId, cancelQueueEdit },
    queue,
    attachments,
    scrollToLatest: () => {},
    submit,
    steer,
    abort: () => undefined,
  })
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:1")
  attachments.addFiles([file("shot.png", "image/png"), file("note.md")])
  return { attachments, composer, queue, revoke, editingQueueId, cancelQueueEdit, remove, steer }
}

afterEach(() => {
  notify.mockClear()
  vi.restoreAllMocks()
})

describe("useComposerSubmit", () => {
  it("压缩上下文走 /compact，保留草稿与待发附件", async () => {
    const submit = vi.fn(() => Promise.resolve(true))
    const { attachments, composer } = setup(submit)

    composer.compact()
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())

    expect(submit).toHaveBeenCalledWith("/compact", undefined, undefined, undefined, {
      preserveDraft: true,
    })
    expect(attachments.files.value).toHaveLength(2)
  })

  it("附件一发出就从输入卡消失，不用等回合跑完", async () => {
    let dispatched = false
    let release!: (sent: boolean) => void
    const { attachments, composer, revoke } = setup((_text, _cwd, _batch, hooks) => {
      dispatched = Boolean(hooks?.onDispatched)
      hooks?.onDispatched?.()
      return new Promise<boolean>((resolve) => {
        release = resolve
      })
    })

    composer.sendNow("附件一轮")

    await vi.waitFor(() => expect(dispatched).toBe(true))
    expect(attachments.files.value).toEqual([])
    expect(revoke).not.toHaveBeenCalled()

    release(true)

    await vi.waitFor(() => expect(revoke).toHaveBeenCalled())
  })

  it("送出后回合失败，附件回到输入卡且可以重新上传", async () => {
    let rejectSubmit!: (error: Error) => void
    const { attachments, composer } = setup((_text, _cwd, _batch, hooks) => {
      hooks?.onDispatched?.()
      return new Promise<boolean>((_resolve, reject) => {
        rejectSubmit = reject
      })
    })

    composer.sendNow("失败的一轮")

    await vi.waitFor(() => expect(attachments.files.value).toEqual([]))
    rejectSubmit(new Error("submit failed"))

    await vi.waitFor(() => expect(attachments.files.value).toHaveLength(2))
    expect(attachments.status.value).toEqual({})
  })

  it("已发出后中途打断或切走只结算释放，不退回输入卡", async () => {
    let release!: (sent: boolean) => void
    const { attachments, composer, revoke } = setup((_text, _cwd, _batch, hooks) => {
      hooks?.onDispatched?.()
      return new Promise<boolean>((resolve) => {
        release = resolve
      })
    })

    composer.sendNow("中途切走的一轮")

    await vi.waitFor(() => expect(attachments.files.value).toEqual([]))
    release(false)

    await vi.waitFor(() => expect(revoke).toHaveBeenCalled())
    expect(attachments.files.value).toEqual([])
  })

  it("排队时附件离开输入卡，但不立刻回收预览地址", () => {
    const { attachments, composer, queue, revoke } = setup(() => Promise.resolve(true))
    let queued: ComposerAttachmentBatch | undefined

    queue.enqueue = (_text, batch) => {
      queued = batch
    }

    composer.enqueue("排队一轮")

    expect(attachments.files.value).toEqual([])
    expect(queued?.files).toHaveLength(2)
    expect(revoke).not.toHaveBeenCalled()
  })

  it("运行中立即发送纯文本排队项走 steer，成功移除并退出编辑态", async () => {
    const submit = vi.fn(() => Promise.resolve(true))
    const { composer, editingQueueId, cancelQueueEdit, remove, steer } = setup(submit, true)
    const item: QueuedPrompt = {
      id: "q1",
      text: "插队引导",
      attachments: undefined,
      attachmentsPreview: [],
      createdAt: 0,
    }

    editingQueueId.value = "q1"
    composer.sendQueued(item)

    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith("q1"))
    expect(steer).toHaveBeenCalledWith("插队引导")
    expect(submit).not.toHaveBeenCalled()
    expect(cancelQueueEdit).toHaveBeenCalledOnce()
  })

  it("运行中立即发送带附件排队项时直接提示警告，不提交也不移除", () => {
    const submit = vi.fn(() => Promise.resolve(true))
    const { composer, remove, steer } = setup(submit, true)
    const item: QueuedPrompt = {
      id: "q2",
      text: "带附件",
      attachments: { batch: "b1", files: [] },
      attachmentsPreview: [],
      createdAt: 0,
    }

    composer.sendQueued(item)

    expect(notify).toHaveBeenCalledWith(expect.any(String), "warning")
    expect(submit).not.toHaveBeenCalled()
    expect(steer).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it("空闲时立即发送排队项会保留输入卡现有草稿", async () => {
    const submit = vi.fn(() => Promise.resolve(true))
    const { composer, remove } = setup(submit, false)
    const item: QueuedPrompt = {
      id: "q3",
      text: "立即发出",
      attachments: undefined,
      attachmentsPreview: [],
      createdAt: 0,
    }

    composer.sendQueued(item)

    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith("q3"))
    expect(submit).toHaveBeenCalledWith("立即发出", undefined, undefined, undefined, {
      preserveDraft: true,
    })
  })
})
