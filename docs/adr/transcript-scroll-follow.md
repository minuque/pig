# 时间线的贴底、脱底与回底滑动策略

- 状态：已采纳
- 代码：`apps/web/src/features/transcript-view/lib/transcript-scroll.ts`（`isTranscriptVisuallyAtBottom`、`FOLLOW_NEAR_BOTTOM_PX`、`resolveFollowTarget`、`createGlideSpring`、`GLIDE_MAX_VIEWPORTS`、`GLIDE_MAX_CATCHUP_FRAMES`、`holdClickedOffset`）、`apps/web/src/features/transcript-view/hooks/use-transcript-follow.ts`（`useTranscriptFollow`）

## 背景

流式正文每一帧都在长高，光靠滚动事件判断底部会不停翻转；同时用户上翻时要立刻停住自动滚动，不能和程序化写入的 `scrollTop` 互相干扰。几处阈值和收敛策略影响手感，单看代码只能看到数字。

## 决定

- 视口离底 48px 内算「视觉贴底」，此时不弹回到底部按钮；判定不按严格相等。
- 脱底与重新吸附带滞回：离底超过半屏才脱底，回到 80px 内且仍在往下滚才重新吸附，中间不翻转。
- 内容增高时用 `settle` 有界收敛：每帧贴底，布局签名连续不变或到帧数上限就停，避免无限 rAF。
- 回底滑动用弹簧逼近，每帧重读目标；离底超过 2.5 屏时先瞬移，只滑最后一段；一帧最多补算 8 个 60fps 帧，卡顿后追赶而不瞬移。
- 程序化写入后进入冷却期，越过上次写入位置的滚动算用户接管，冷却不拦。
- 自记小数 `scrollTop`，不读回浏览器取整后的值；收起卡片时把按钮留在点击时的视口位置直到高度动画结束。

## 后果

手感参数集中在这两个文件里，调参先看这里再改常量。新增的滚动写入必须走同一套冷却与接管判断，否则会和弹簧、`settle` 抢同一帧；改动 `FOLLOW_NEAR_BOTTOM_PX` 或半屏滞回会直接改变「上翻一点点就脱底」的敏感度。
