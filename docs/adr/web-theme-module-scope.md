# 主题状态用分离的 effectScope 跟模块同寿命

- 状态：已采纳
- 代码：`apps/web/src/utils/theme-mode.ts`（`scope`、`state`）、`apps/web/src/features/theme/index.ts`（`scope`、`theme`）

## 背景

颜色模式与预设是全局单例：任何组件都可能读写，派生出来的 computed 也一样。直接在首个调用它的组件里建，这些 computed 和 effect 会挂进那个组件的作用域，组件卸载时一起停掉，之后读到的就是停掉的引用。

## 决定

用 `effectScope(true)` 建分离作用域保存状态，模块级 `??=` 保证只建一次；computed 与 effect 挂在这个分离作用域里，不随任何组件挂载卸载。

## 后果

全仓只有这一份状态，新增派生状态也放进同一个 scope。状态入口要保持幂等，不能在里面注册依赖组件生命周期的回调。
