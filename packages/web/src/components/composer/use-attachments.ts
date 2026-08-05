import { ref } from "vue";

export type AttachmentKind = "image" | "file";
export type Attachment = { id: number; name: string; kind: AttachmentKind };

/** 附件标记文本拼接：正文 + 每个附件一行 `[附件: 名]`；无附件时仅返回去除首尾空白的正文。 */
export function composeAttachmentText(base: string, attachments: Attachment[]): string {
  const parts = [base.trim()];
  for (const att of attachments) parts.push(`[附件: ${att.name}]`);
  return parts.filter(Boolean).join("\n");
}

/** 单个文件映射为附件：MIME 为 image/* 时按图片处理，否则沿用菜单选择的 fallback 类型。 */
export function attachmentFromFile(
  file: { name: string; type: string },
  fallback: AttachmentKind,
): Omit<Attachment, "id"> {
  return { name: file.name, kind: file.type.startsWith("image/") ? "image" : fallback };
}

/** 附件状态：chip 列表（含移除动画标记）、菜单开关、文件变更写入与提交文本组合。 */
export function useAttachments() {
  const attachments = ref<Attachment[]>([]);
  const exitingAtt = ref<number[]>([]);
  /** 附件菜单开关：绑定 reka-ui DropdownMenu 的 v-model:open，打开/关闭/外点/Escape 由 reka 管理 */
  const menuOpen = ref(false);
  /** 未触发的移除定时器，组件卸载时统一清理 */
  const pendingTimers = new Set<number>();
  let nextId = 1;

  function onFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    const fallback = (input.dataset.kind as AttachmentKind) ?? "file";
    attachments.value = [
      ...attachments.value,
      ...files.map((f) => ({ id: nextId++, ...attachmentFromFile(f, fallback) })),
    ];
    input.value = "";
  }
  function removeAttachment(id: number) {
    if (!exitingAtt.value.includes(id)) exitingAtt.value = [...exitingAtt.value, id];
    const timer = window.setTimeout(() => {
      pendingTimers.delete(timer);
      attachments.value = attachments.value.filter((a) => a.id !== id);
      exitingAtt.value = exitingAtt.value.filter((x) => x !== id);
    }, 200);
    pendingTimers.add(timer);
  }
  /** 组合提交文本：正文 + 附件标记行 */
  function composeText(base: string) {
    return composeAttachmentText(base, attachments.value);
  }
  function clear() {
    attachments.value = [];
    exitingAtt.value = [];
    menuOpen.value = false;
  }
  /** 卸载时清掉尚未触发的移除定时器，避免组件销毁后回调残留 */
  function dispose() {
    pendingTimers.forEach((t) => window.clearTimeout(t));
    pendingTimers.clear();
  }
  return {
    attachments,
    exitingAtt,
    menuOpen,
    onFiles,
    removeAttachment,
    composeText,
    clear,
    dispose,
  };
}
