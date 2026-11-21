export const MAX_FILE_BYTES = 25 * 1024 * 1024
// 外部：provider 内联上限约 4.5MB base64，3MB 编码后约 4MB
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
export const MAX_BATCH_ITEMS = 8
// 外部：provider 只稳定吃这几种内联图片；svg/bmp/heic 走文件落盘，否则整轮会被拒
export const INLINE_IMAGE_MIME_PATTERN = /^image\/(png|jpeg|gif|webp)$/i
