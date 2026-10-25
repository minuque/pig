/**
 * Radix Colors accent：id 存 localStorage，浅深两份 hex 注入 --accent-*。
 * 阶号对齐 Radix：9 实体、10 hover、11 低对比文本、12 高对比文本。
 * alpha 阶 3/4/6/9 对应 hover 底、active 底、边、实体填充。
 * 值取自 @radix-ui/colors 的 sRGB alpha 刻度。
 */
export type AccentId =
  | "indigo"
  | "iris"
  | "violet"
  | "purple"
  | "blue"
  | "cyan"
  | "teal"
  | "green"
  | "orange"
  | "red"
  | "crimson"
  | "pink"
  | "amber"
  | "sky"

export type AccentDefinition = Readonly<{
  id: AccentId
  label: string
  /** 实色上文字：bright（sky/amber 类高亮）用前景色，其余白 */
  contrast: "light" | "dark"
  light: Readonly<{
    step9: string
    step10: string
    step11: string
    a3: string
    a4: string
    a6: string
    a9: string
  }>
  dark: Readonly<{
    step9: string
    step10: string
    step11: string
    a3: string
    a4: string
    a6: string
    a9: string
  }>
}>

export const ACCENTS: ReadonlyArray<AccentDefinition> = [
  {
    id: "indigo",
    label: "Indigo",
    contrast: "light",
    light: {
      step9: "#3e63dd",
      step10: "#3358d4",
      step11: "#3a5bc7",
      a3: "#0047f112",
      a4: "#0044ff1e",
      a6: "#003eff3e",
      a9: "#0031d2c1",
    },
    dark: {
      step9: "#3e63dd",
      step10: "#5472e4",
      step11: "#9eb1ff",
      a3: "#2f62ff3c",
      a4: "#3566ff57",
      a6: "#5178fd7c",
      a9: "#4671ffdb",
    },
  },
  {
    id: "iris",
    label: "Iris",
    contrast: "light",
    light: {
      step9: "#5b5bd6",
      step10: "#5151cd",
      step11: "#5753c6",
      a3: "#0011ee0f",
      a4: "#000bff19",
      a6: "#000aff34",
      a9: "#0000c0a4",
    },
    dark: {
      step9: "#5b5bd6",
      step10: "#6e6ade",
      step11: "#b1a9ff",
      a3: "#525bff3b",
      a4: "#4d58ff5a",
      a6: "#6d6ffd7a",
      a9: "#6a6afed4",
    },
  },
  {
    id: "violet",
    label: "Violet",
    contrast: "light",
    light: {
      step9: "#6e56cf",
      step10: "#654dc4",
      step11: "#6550b9",
      a3: "#4400ee0f",
      a4: "#4300ff1b",
      a6: "#3100fb35",
      a9: "#2400b7a9",
    },
    dark: {
      step9: "#6e56cf",
      step10: "#7d66d9",
      step11: "#baa7ff",
      a3: "#8354fe36",
      a4: "#7d51fd50",
      a6: "#8f6cfd6d",
      a9: "#8668ffcc",
    },
  },
  {
    id: "purple",
    label: "Purple",
    contrast: "light",
    light: {
      step9: "#8e4ec6",
      step10: "#8347b9",
      step11: "#8145b5",
      a3: "#8e00f112",
      a4: "#8d00e51d",
      a6: "#7a01d03b",
      a9: "#5c00adb1",
    },
    dark: {
      step9: "#8e4ec6",
      step10: "#9a5cd0",
      step11: "#d19dff",
      a3: "#c150ff2d",
      a4: "#bb53fd42",
      a6: "#c16dfd61",
      a9: "#b661ffc2",
    },
  },
  {
    id: "blue",
    label: "Blue",
    contrast: "light",
    light: {
      step9: "#0090ff",
      step10: "#0588f0",
      step11: "#0d74ce",
      a3: "#008ff519",
      a4: "#009eff2a",
      a6: "#0088f653",
      a9: "#0090ff",
    },
    dark: {
      step9: "#0090ff",
      step10: "#3b9eff",
      step11: "#70b8ff",
      a3: "#0077ff3a",
      a4: "#0075ff57",
      a6: "#0f89fd7f",
      a9: "#0090ff",
    },
  },
  {
    id: "cyan",
    label: "Cyan",
    contrast: "light",
    light: {
      step9: "#00a2c7",
      step10: "#0797b9",
      step11: "#107d98",
      a3: "#00c2d121",
      a4: "#00bcd435",
      a6: "#00a7c162",
      a9: "#00a2c7",
    },
    dark: {
      step9: "#00a2c7",
      step10: "#23afd0",
      step11: "#4ccce6",
      a3: "#00befd28",
      a4: "#00baff3b",
      a6: "#00c7fd5e",
      a9: "#00cfffc3",
    },
  },
  {
    id: "teal",
    label: "Teal",
    contrast: "light",
    light: {
      step9: "#12a594",
      step10: "#0d9b8a",
      step11: "#008573",
      a3: "#00c69d1f",
      a4: "#00c39633",
      a6: "#00a6855e",
      a9: "#009e8ced",
    },
    dark: {
      step9: "#12a594",
      step10: "#0eb39e",
      step11: "#0bd8b6",
      a3: "#00ffe61e",
      a4: "#00ffe92d",
      a6: "#1cffe84b",
      a9: "#13ffe49f",
    },
  },
  {
    id: "green",
    label: "Green",
    contrast: "light",
    light: {
      step9: "#30a46c",
      step10: "#2b9a66",
      step11: "#218358",
      a3: "#00a43319",
      a4: "#00a83829",
      a6: "#00963c52",
      a9: "#008f4acf",
    },
    dark: {
      step9: "#30a46c",
      step10: "#33b074",
      step11: "#3dd68c",
      a3: "#22ff991e",
      a4: "#11ff992d",
      a6: "#44ffaa4b",
      a9: "#44ffa49e",
    },
  },
  {
    id: "orange",
    label: "Orange",
    contrast: "dark",
    light: {
      step9: "#f76b15",
      step10: "#ef5f00",
      step11: "#cc4e00",
      a3: "#ff9c0029",
      a4: "#ff91014a",
      a6: "#ff81007d",
      a9: "#f65e00ea",
    },
    dark: {
      step9: "#f76b15",
      step10: "#ff801f",
      step11: "#ffa057",
      a3: "#fb6a0025",
      a4: "#ff590039",
      a6: "#fd75045c",
      a9: "#fe6d15f7",
    },
  },
  {
    id: "red",
    label: "Red",
    contrast: "light",
    light: {
      step9: "#e5484d",
      step10: "#dc3e42",
      step11: "#ce2c31",
      a3: "#f3000d14",
      a4: "#ff000824",
      a6: "#f8000442",
      a9: "#db0007b7",
    },
    dark: {
      step9: "#e5484d",
      step10: "#ec5d5e",
      step11: "#ff9592",
      a3: "#ff173f2d",
      a4: "#fe0a3b44",
      a6: "#ff3e5668",
      a9: "#fe4e54e4",
    },
  },
  {
    id: "crimson",
    label: "Crimson",
    contrast: "light",
    light: {
      step9: "#e93d82",
      step10: "#df3478",
      step11: "#cb1d63",
      a3: "#ff005216",
      a4: "#f8005123",
      a6: "#d0004b41",
      a9: "#e2005bc2",
    },
    dark: {
      step9: "#e93d82",
      step10: "#ee518a",
      step11: "#ff92ad",
      a3: "#fe2a8b2a",
      a4: "#fd158741",
      a6: "#fe459763",
      a9: "#fe418de8",
    },
  },
  {
    id: "pink",
    label: "Pink",
    contrast: "light",
    light: {
      step9: "#d6409f",
      step10: "#cf3897",
      step11: "#c2298a",
      a3: "#f4008c16",
      a4: "#e2008b23",
      a6: "#c0007840",
      a9: "#c8007fbf",
    },
    dark: {
      step9: "#d6409f",
      step10: "#de51a8",
      step11: "#ff8dcc",
      a3: "#fe37cc29",
      a4: "#fc1ec43f",
      a6: "#fd51c75f",
      a9: "#fe49bcd4",
    },
  },
  {
    id: "amber",
    label: "Amber",
    contrast: "dark",
    light: {
      step9: "#ffc53d",
      step10: "#ffba18",
      step11: "#ab6400",
      a3: "#ffde003d",
      a4: "#ffd40063",
      a6: "#eab5008c",
      a9: "#ffb300c2",
    },
    dark: {
      step9: "#ffc53d",
      step10: "#ffd60a",
      step11: "#ffca16",
      a3: "#fa820022",
      a4: "#fc820032",
      a6: "#fd9b0051",
      a9: "#ffc53d",
    },
  },
  {
    id: "sky",
    label: "Sky",
    contrast: "dark",
    light: {
      step9: "#7ce2fe",
      step10: "#74daf8",
      step11: "#00749e",
      a3: "#00b3ee1e",
      a4: "#00ace42e",
      a6: "#0092ca56",
      a9: "#00c7fe83",
    },
    dark: {
      step9: "#7ce2fe",
      step10: "#a8eeff",
      step11: "#75c7f0",
      a3: "#1184fc33",
      a4: "#128fff49",
      a6: "#28a5ff72",
      a9: "#7ce3fffe",
    },
  },
]
export const DEFAULT_ACCENT_ID: AccentId = "indigo"

export function findAccent(id: string | null | undefined): AccentDefinition {
  return ACCENTS.find((accent) => accent.id === id) ?? (ACCENTS[0] as AccentDefinition)
}

export function isAccentId(value: string | null | undefined): value is AccentId {
  return ACCENTS.some((accent) => accent.id === value)
}
