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
  },
  overrides: [
    {
      files: ["**/*.vue"],
      customSyntax: "postcss-html",
    },
  ],
}
