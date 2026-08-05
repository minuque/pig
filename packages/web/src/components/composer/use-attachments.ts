import { onBeforeUnmount, ref, watch } from "vue";

export type AttachmentKind = "image" | "file";
export type Attachment = { id: number; name: string; kind: AttachmentKind };

/** 附件管理：`+` 菜单、文件选择、chip 列表（含移除动画标记）与提交文本组合。 */
export function useAttachments() {
  const attachments = ref<Attachment[]>([]);
  const exitingAtt = ref<number[]>([]);
  const menuOpen = ref(false);
  const plusWrap = ref<HTMLElement | null>(null);
  const fileRef = ref<HTMLInputElement | null>(null);
  let nextId = 1;

  function openPicker(kind: AttachmentKind) {
    const input = fileRef.value;
    if (!input) return;
    input.accept = kind === "image" ? "image/*" : "";
    input.value = "";
    input.dataset.kind = kind;
    input.click();
    menuOpen.value = false;
  }
  function onFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    const fallback = (input.dataset.kind as AttachmentKind) ?? "file";
    attachments.value = [
      ...attachments.value,
      ...files.map((f) => ({
        id: nextId++,
        name: f.name,
        kind: f.type.startsWith("image/") ? ("image" as const) : fallback,
      })),
    ];
    input.value = "";
  }
  function removeAttachment(id: number) {
    if (!exitingAtt.value.includes(id)) exitingAtt.value = [...exitingAtt.value, id];
    window.setTimeout(() => {
      attachments.value = attachments.value.filter((a) => a.id !== id);
      exitingAtt.value = exitingAtt.value.filter((x) => x !== id);
    }, 200);
  }
  /** 组合提交文本：正文 + 附件标记行 */
  function composeText(base: string) {
    const parts = [base.trim()];
    for (const att of attachments.value) parts.push(`[附件: ${att.name}]`);
    return parts.filter(Boolean).join("\n");
  }
  function clear() {
    attachments.value = [];
    exitingAtt.value = [];
    menuOpen.value = false;
  }
  function onDocDown(e: PointerEvent) {
    if (menuOpen.value && plusWrap.value && !plusWrap.value.contains(e.target as Node))
      menuOpen.value = false;
  }
  function onDocKey(e: KeyboardEvent) {
    if (e.key === "Escape") menuOpen.value = false;
  }
  watch(menuOpen, (open) => {
    if (open) {
      document.addEventListener("pointerdown", onDocDown);
      document.addEventListener("keydown", onDocKey);
    } else {
      document.removeEventListener("pointerdown", onDocDown);
      document.removeEventListener("keydown", onDocKey);
    }
  });
  onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", onDocDown);
    document.removeEventListener("keydown", onDocKey);
  });
  return {
    attachments,
    exitingAtt,
    menuOpen,
    plusWrap,
    fileRef,
    openPicker,
    onFiles,
    removeAttachment,
    composeText,
    clear,
  };
}
