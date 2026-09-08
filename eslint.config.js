import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import globals from "globals"

import stylistic from "@stylistic/eslint-plugin"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import pluginVue from "eslint-plugin-vue"
import tseslint from "typescript-eslint"

/** 函数声明，含 `export function` / `export default function` */
const functionDecl = [
  "function",
  { selector: "ExportNamedDeclaration[declaration.type='FunctionDeclaration']" },
  { selector: "ExportDefaultDeclaration[declaration.type='FunctionDeclaration']" },
]

export default defineConfig(
  globalIgnores(
    [
      "**/dist/**",
      "**/node_modules/**",
      "**/out/**",
      "packages/gateway/web/**",
      "release/**",
      "docs/**",
      ".tmp/**",
      ".worktrees/**",
      "playwright-report/**",
      "test-results/**",
    ],
    "pig/ignores",
  ),

  {
    name: "pig/globals",
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs["flat/recommended"],

  {
    name: "pig/overrides",
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-control-regex": "off",
      "no-empty": "off",
      "no-empty-pattern": "off",
      "prefer-const": "off",
      "preserve-caught-error": "off",
      // 共享状态对象：允许改 props 字段，禁止替换 props 本身
      "vue/no-mutating-props": ["error", { shallowOnly: true }],
    },
  },

  {
    name: "pig/vue-filenames",
    files: ["**/components/ui/**/*.vue", "**/features/*/index.vue"],
    // shadcn-vue 单字名；feature 入口按目录必须是 index.vue
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },

  {
    name: "pig/vue-parser",
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  eslintConfigPrettier,

  {
    name: "pig/style",
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      semi: ["error", "never"],
      // 顶层函数之间、变量声明与函数之间空一行
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: functionDecl, next: functionDecl },
        { blankLine: "always", prev: ["const", "let", "var"], next: functionDecl },
        { blankLine: "always", prev: functionDecl, next: ["const", "let", "var"] },
      ],
    },
  },
)
