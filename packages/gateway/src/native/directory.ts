import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PICKER_TIMEOUT_MS = 60_000;
const folderPickerScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = [System.Windows.Forms.FolderBrowserDialog]::new()
try {
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.Write((ConvertTo-Json -Compress -InputObject $dialog.SelectedPath))
  }
} finally {
  $dialog.Dispose()
}
`;

/** 目录选择平台端口。非 Windows 由 Browser 提供粘贴路径。 */
export interface DirectoryPort {
  readonly requiresManualInput?: boolean;
  selectDirectory(): Promise<string | undefined>;
  validateDirectory(path: string): Promise<string>;
}

export function canonicalizePath(path: string): string {
  const normalized = resolve(path).replaceAll("\\", "/").replace(/\/$/, "");
  return /^[A-Z]:/.test(normalized)
    ? normalized[0]!.toLowerCase() + normalized.slice(1)
    : normalized;
}

async function validateDirectory(path: string): Promise<string> {
  return canonicalizePath(await realpath(path));
}

export class WindowsDirectoryPort implements DirectoryPort {
  async selectDirectory(): Promise<string | undefined> {
    let lastError: unknown;
    for (const executable of ["pwsh", "powershell.exe"]) {
      try {
        const { stdout } = await execFileAsync(
          executable,
          ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-Command", folderPickerScript],
          { encoding: "utf8", windowsHide: true, timeout: PICKER_TIMEOUT_MS },
        );
        if (!stdout.trim()) return undefined;
        const selected: unknown = JSON.parse(stdout);
        if (typeof selected !== "string" || !selected.trim())
          throw new Error("invalid folder path");
        return validateDirectory(selected);
      } catch (error) {
        lastError = error;
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    throw lastError;
  }

  validateDirectory = validateDirectory;
}

export class ManualDirectoryPort implements DirectoryPort {
  readonly requiresManualInput = true;
  async selectDirectory(): Promise<undefined> {
    return undefined;
  }
  validateDirectory = validateDirectory;
}
