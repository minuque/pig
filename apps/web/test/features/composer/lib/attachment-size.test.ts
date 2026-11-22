import { describe, expect, it } from "vitest"
import { formatFileSize } from "@features/composer/lib/attachment-size.js"

describe("formatFileSize", () => {
  it("按字节、KB、MB 逐级换算", () => {
    expect(formatFileSize(0)).toBe("0 B")
    expect(formatFileSize(900)).toBe("900 B")
    expect(formatFileSize(2048)).toBe("2.0 KB")
    expect(formatFileSize(1024 * 1024 * 3)).toBe("3.0 MB")
    expect(formatFileSize(1024 * 1024 * 42)).toBe("42 MB")
  })
})
