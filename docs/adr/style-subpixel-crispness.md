# 非整数缩放下的清晰度取舍

- 状态：已采纳
- 代码：`apps/web/src/style/tokens.css`（`--separator-top`、`--icon-stroke`）

## 背景

界面在 125% / 150% 这类缩放下会落到非整数设备像素，1px 的边和 1.75 的线宽不一定落在整数像素上。

## 决定

- 卡片内的行间分隔用 `--separator-top`（`inset` 内阴影）而不是 `border`：非整数缩放下 `border` 会发毛，内阴影不会。
- 线性图标的 `--icon-stroke` 取 1.75（24 画布）。低于 1.71 时，14px 图标下的等效线宽不到 1px，会糊成半调灰。

## 后果

把行线「统一成 `border`」，或把 `--icon-stroke` 调到 1.5，都会在缩放窗口里看到发毛与发灰。
