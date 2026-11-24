import { describe, expect, it } from "vitest"
import {
  contrastRatio,
  deriveThemeTokens,
  hexToOklch,
  hexToRgb,
  oklchToHex,
  relativeLuminance,
  THEME_PRESETS,
} from "../../src/theme/index.js"

describe("theme-palette OKLCH 推导", () => {
  it("常见 sRGB 与中性灰在 OKLCH 往返转换后误差很小", () => {
    for (const hex of ["#ffffff", "#101012", "#5e6ad2", "#2563eb", "#b55d35", "#247a57"]) {
      const converted = oklchToHex(hexToOklch(hex))
      const [r1, g1, b1] = hexToRgb(hex)
      const [r2, g2, b2] = hexToRgb(converted)

      expect(Math.abs(r1 - r2)).toBeLessThan(0.015)
      expect(Math.abs(g1 - g2)).toBeLessThan(0.015)
      expect(Math.abs(b1 - b2)).toBeLessThan(0.015)
    }
  })

  it("所有内置配色方案在深浅模式下均满足可读对比度与层级顺序", () => {
    for (const preset of THEME_PRESETS) {
      for (const isDark of [false, true]) {
        const tokens = deriveThemeTokens(isDark ? preset.dark : preset.light, isDark)
        const bg = tokens["--bg"]
        const sidebar = tokens["--sidebar"]
        const surface = tokens["--bg-surface"]
        const raised = tokens["--bg-raised"]

        expect(contrastRatio(tokens["--fg"], bg), `${preset.id} fg`).toBeGreaterThanOrEqual(11)
        expect(
          contrastRatio(tokens["--fg-secondary"], bg),
          `${preset.id} fg-secondary`,
        ).toBeGreaterThanOrEqual(6)
        expect(
          contrastRatio(tokens["--fg-muted"], bg),
          `${preset.id} fg-muted`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(tokens["--accent-text"], bg),
          `${preset.id} accent-text vs bg`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(tokens["--accent-text"], surface),
          `${preset.id} accent-text vs surface`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(tokens["--fg-on-accent"], tokens["--accent-solid"]),
          `${preset.id} fg-on-accent`,
        ).toBeGreaterThanOrEqual(3.8)

        if (isDark) {
          expect(relativeLuminance(sidebar)).toBeLessThanOrEqual(relativeLuminance(bg))
          expect(relativeLuminance(surface)).toBeGreaterThan(relativeLuminance(bg))
          expect(relativeLuminance(raised)).toBeGreaterThan(relativeLuminance(surface))
          expect(hexToOklch(tokens["--accent-solid-hover"]).l).toBeGreaterThan(
            hexToOklch(tokens["--accent-solid"]).l,
          )
        } else {
          expect(relativeLuminance(sidebar)).toBeLessThan(relativeLuminance(bg))
          expect(relativeLuminance(raised)).toBeGreaterThan(relativeLuminance(surface))
          expect(hexToOklch(tokens["--accent-solid-hover"]).l).toBeLessThan(
            hexToOklch(tokens["--accent-solid"]).l,
          )
        }
      }
    }
  })
})
