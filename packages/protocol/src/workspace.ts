/** 环境列表的一项；saved 表示 pig 自己保存过（带默认目录）。 */
export interface EnvironmentInfo {
  id: string
  kind: "local" | "ssh"
  host?: string
  defaultPath?: string
  saved: boolean
}

/** @ 文件引用候选：cwd 相对路径，目录带尾斜杠。 */
export interface FileSearchEntry {
  path: string
  kind: "file" | "directory"
}

/** / 菜单候选：技能与 prompt 模板。 */
export interface ComposerCommand {
  name: string
  description: string
  /** 模板用法提示，如 "<issue-number>"。 */
  argumentHint?: string
}
