import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes, later classes win (shadcn-vue convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
