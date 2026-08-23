import { onUnmounted, ref } from "vue";

export const MAX_COMPOSER_ATTACHMENTS = 6;

export interface ComposerAttachment {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  file: File;
}

/** 只保留 image/*；FileList / File[] / 空值均可。 */
export function imageFilesFrom(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter((file) => file.type.startsWith("image/"));
}

/** 当前已有张数下还能再收几张（上限 6）。 */
export function roomForAttachments(
  currentCount: number,
  incomingCount: number,
  max = MAX_COMPOSER_ATTACHMENTS,
): number {
  return Math.max(0, Math.min(incomingCount, max - currentCount));
}

/** 剪贴板里的图片；没有图返回空，调用方据此决定是否拦截粘贴。 */
export function imageFilesFromClipboard(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  const fromFiles = imageFilesFrom(data.files);
  if (fromFiles.length > 0) return fromFiles;
  const picked: File[] = [];
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (!item || item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) picked.push(file);
  }
  return imageFilesFrom(picked);
}

/** 输入卡本地附图：blob URL 只活在 composer，不进协议。 */
export function useComposerAttachments(max = MAX_COMPOSER_ATTACHMENTS) {
  const attachments = ref<ComposerAttachment[]>([]);

  function addFiles(files: FileList | File[] | null | undefined) {
    const images = imageFilesFrom(files);
    const room = roomForAttachments(attachments.value.length, images.length, max);
    if (room === 0) return;
    const added = images.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name || "image",
      mimeType: file.type,
      url: URL.createObjectURL(file),
      file,
    }));
    attachments.value = [...attachments.value, ...added];
  }

  function remove(id: string) {
    const kept: ComposerAttachment[] = [];
    for (const item of attachments.value) {
      if (item.id === id) URL.revokeObjectURL(item.url);
      else kept.push(item);
    }
    attachments.value = kept;
  }

  function clear() {
    for (const item of attachments.value) URL.revokeObjectURL(item.url);
    attachments.value = [];
  }

  onUnmounted(clear);

  return { attachments, addFiles, remove, clear };
}
