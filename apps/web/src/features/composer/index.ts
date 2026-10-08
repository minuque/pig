export { useSessionComposer } from "@features/composer/hooks/use-session-composer.js"

import { t } from "@i18n/index.js"

/** 输入卡占位文案：欢迎页与会话页共用一处；组件内读时取当前语言。 */
export function promptPlaceholder(): string {
  return t("composer.placeholder")
}
