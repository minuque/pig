/** 跨设备通用的用户偏好：落在 gateway 的 preferences.json，localStorage 只是首屏镜像。 */
export type UserThemeMode = "auto" | "light" | "dark"

export type UserWelcomeField = "mask" | "off"

export type UserDensity = "compact" | "normal"

export type UserLocale = "en" | "zh-CN"

export type UserChatWidth = "comfortable" | "wide" | "full"

export type UserRailSection = "environment" | "context" | "tasks"

export interface UserRailLayout {
  closed: UserRailSection[]
  hidden: UserRailSection[]
}

export interface UserPreferences {
  theme: UserThemeMode
  welcomeField: UserWelcomeField
  uiFont: string
  codeFont: string
  density: UserDensity
  codeSize: number
  locale: UserLocale
  chatWidth: UserChatWidth
  notify: boolean
  userName: string
  clickSound: boolean
  favoriteModels: string[]
  railLayout: UserRailLayout
}

export type UserPreferencesPatch = Partial<UserPreferences>
