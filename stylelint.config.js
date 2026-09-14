import { lintIgnores } from "./scripts/lint-ignores.mjs"

/** @type {import("stylelint").Config} */
export default {
  ignoreFiles: lintIgnores,
  rules: {
    "rule-empty-line-before": [
      "always",
      {
        except: ["first-nested"],
        ignore: ["after-comment"],
      },
    ],
    "at-rule-empty-line-before": [
      "always",
      {
        except: ["first-nested", "blockless-after-same-name-blockless"],
        ignore: ["after-comment"],
      },
    ],
    "block-no-empty": true,
    "declaration-block-no-duplicate-properties": [
      true,
      { ignore: ["consecutive-duplicates-with-different-values"] },
    ],
    "declaration-block-no-shorthand-property-overrides": true,
    "no-duplicate-selectors": true,
    "property-no-unknown": [true, { ignoreProperties: ["app-region"] }],
    "selector-pseudo-class-no-unknown": [
      true,
      { ignorePseudoClasses: ["deep", "global", "slotted"] },
    ],
    "selector-pseudo-element-no-unknown": true,
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "theme",
          "utility",
          "plugin",
          "source",
          "custom-variant",
          "apply",
          "reference",
          "config",
          "variant",
        ],
      },
    ],
  },
  overrides: [
    {
      files: ["**/*.vue"],
      customSyntax: "postcss-html",
      rules: {
        // SFC 只消费 token，色值写在 app.css
        "color-no-hex": true,
        "function-disallowed-list": [
          "rgb",
          "rgba",
          "hsl",
          "hsla",
          "hwb",
          "lab",
          "lch",
          "oklab",
          "oklch",
          "color",
          "color-mix",
        ],
      },
    },
  ],
}
