export interface TextWidthTarget {
  scrollWidth: number
  clientWidth: number
}

export function isTextOverflowing(target: TextWidthTarget | null | undefined): boolean {
  return Boolean(target && target.scrollWidth > target.clientWidth + 1)
}

export function shouldCancelOverflowOpen(
  open: boolean,
  target: TextWidthTarget | null | undefined,
  always = false,
): boolean {
  return open && !always && !isTextOverflowing(target)
}
