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
  // 只要会出错的规则；recommended 里的 warn 惯例/Options API 本仓用不上
  pluginVue.configs["flat/essential"],

  {
    name: "pig/overrides",
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // 边界类型先 any，TS 收紧后再开
      "@typescript-eslint/no-unused-vars": "off", // 与 Vue 宏、前缀参数误报重叠，交给 TS
      "no-control-regex": "off", // ANSI/控制字符正则合法
      "no-empty": "off", // 允许空 catch / 占位块
      "no-empty-pattern": "off", // 允许空解构占位
      "prefer-const": "off", // 后续会赋值的 let 不强制改 const
      "preserve-caught-error": "off", // 不强制 catch 再抛时带 cause
      // 共享状态对象：允许改 props 字段，禁止替换 props 本身
      "vue/no-mutating-props": ["error", { shallowOnly: true }],
      // 对齐 SFC 顺序：template → script → style
      "vue/block-order": ["error", { order: ["template", "script", "style"] }],
      "vue/no-v-html": "error", // 禁止未消毒 HTML，防 XSS
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

  // 关掉与 Prettier 冲突的格式规则；分号由 Prettier 管
  eslintConfigPrettier,

  {
    name: "pig/style",
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
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
