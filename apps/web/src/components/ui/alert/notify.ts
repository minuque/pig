import { readonly, ref } from "vue";

export type NoticeVariant = "default" | "destructive";

export interface Notice {
  id: number;
  message: string;
  variant: NoticeVariant;
}

const DURATION_MS = 5000;

const notices = ref<Notice[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 1;

export const noticeQueue = readonly(notices);

export function dismissNotice(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  notices.value = notices.value.filter((item) => item.id !== id);
}

export function clearNotices(): void {
  for (const id of [...timers.keys()]) dismissNotice(id);
}

function pushNotice(message: string, variant: NoticeVariant): void {
  const text = message.trim();
  if (!text) return;
  const id = nextId;
  nextId += 1;
  notices.value = [...notices.value, { id, message: text, variant }];
  timers.set(
    id,
    setTimeout(() => {
      dismissNotice(id);
    }, DURATION_MS),
  );
}

export const notify = Object.assign(
  (message: string) => {
    pushNotice(message, "default");
  },
  {
    error(message: string) {
      pushNotice(message, "destructive");
    },
  },
);
