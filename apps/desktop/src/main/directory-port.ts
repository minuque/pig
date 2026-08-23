import { realpath } from "node:fs/promises";
import type { BrowserWindow, OpenDialogOptions, OpenDialogReturnValue } from "electron";

const DIALOG_OPTIONS = {
  title: "选择工作目录",
  properties: ["openDirectory", "createDirectory"],
} as const satisfies OpenDialogOptions;

export type CanonicalizePath = (path: string) => string;

export type DirectoryPort = {
  selectDirectory(): Promise<string | undefined>;
  validateDirectory(path: string): Promise<string>;
};

export type PickDirectory = (
  parent: BrowserWindow | undefined,
  options: typeof DIALOG_OPTIONS,
) => Promise<OpenDialogReturnValue>;

export function createElectronDirectoryPort(
  getWindow: () => BrowserWindow | undefined,
  pickDirectory: PickDirectory,
  canonicalizePath: CanonicalizePath,
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
