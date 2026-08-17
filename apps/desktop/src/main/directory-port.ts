import { realpath } from "node:fs/promises";
import type { BrowserWindow, OpenDialogOptions, OpenDialogReturnValue } from "electron";
import {
  canonicalizePath,
  type DirectoryPort,
} from "../../../../packages/gateway/src/directory.js";

const DIALOG_OPTIONS = {
  title: "选择工作区",
  properties: ["openDirectory", "createDirectory"],
} as const satisfies OpenDialogOptions;

export type PickDirectory = (
  parent: BrowserWindow | undefined,
  options: typeof DIALOG_OPTIONS,
) => Promise<OpenDialogReturnValue>;

export function createElectronDirectoryPort(
  getWindow: () => BrowserWindow | undefined,
  pickDirectory: PickDirectory,
): DirectoryPort {
  return {
    async selectDirectory() {
      const result = await pickDirectory(getWindow(), DIALOG_OPTIONS);
      const selected = result.filePaths[0];
      if (result.canceled || !selected) return undefined;
      return canonicalizePath(await realpath(selected));
    },
    async validateDirectory(path) {
      return canonicalizePath(await realpath(path));
    },
  };
}
