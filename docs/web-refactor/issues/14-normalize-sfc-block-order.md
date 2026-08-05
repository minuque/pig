# 14 — 统一 Vue SFC 区块顺序

**What to build:** 在功能重构全部完成后，将所有 Vue 单文件组件统一重排为 `<template>` → `<script>` → `<style>`；只调整顶层区块位置，不改变组件行为。

**Blocked by:** 01（修复 Run 预响应事件重放）、13（收尾 App 样式与死代码）

**Status:** ready-for-agent

- [X]  全部 Vue SFC 的顶层区块顺序为 template → script → style
- [X]  普通 script 与 script setup 同时存在时均位于 template 之后、style 之前
- [X]  仅重排区块，不夹带功能或样式改动
- [X]  typecheck 通过，vitest 全绿
- [X]  浏览器抽查关键流程无回归
