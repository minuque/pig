export type ChildMessage =
  | { type: "ready"; port: number; launchToken: string }
  | { type: "failed"; message: string }
  | { type: "select-directory"; id: number }

export type DirectorySelected = {
  type: "directory-selected"
  id: number
  path?: string
  error?: string
}

export type ParentMessage = DirectorySelected | { type: "stop" }
