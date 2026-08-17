import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PICKER_TIMEOUT_MS = 60_000;

/** IFileOpenDialog + Per-Monitor V2：现代资源管理器对话框，避免 WinForms FolderBrowser 被系统拉伸发糊。 */
const folderPickerScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class FolderPicker
{
    const uint FOS_NOCHANGEDIR = 0x00000008;
    const uint FOS_PICKFOLDERS = 0x00000020;
    const uint FOS_FORCEFILESYSTEM = 0x00000040;
    const uint FOS_PATHMUSTEXIST = 0x00000800;
    const uint SIGDN_FILESYSPATH = 0x80058000;

    public static string Pick(string title)
    {
        SetDpiAware();
        IFileDialog dialog = (IFileDialog)new FileOpenDialogRCW();
        uint options;
        dialog.GetOptions(out options);
        dialog.SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST | FOS_NOCHANGEDIR);
        if (!string.IsNullOrEmpty(title))
        {
            dialog.SetTitle(title);
        }
        int hr = dialog.Show(GetForegroundWindow());
        if (hr != 0)
        {
            return null;
        }
        IShellItem item;
        dialog.GetResult(out item);
        string path;
        item.GetDisplayName(SIGDN_FILESYSPATH, out path);
        return path;
    }

    static void SetDpiAware()
    {
        if (!SetProcessDpiAwarenessContext(new IntPtr(-4)))
        {
            SetProcessDPIAware();
        }
    }

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    [ComImport]
    [ClassInterface(ClassInterfaceType.None)]
    [Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
    class FileOpenDialogRCW { }

    [ComImport]
    [Guid("42f85136-db7e-439c-85f1-e4075d135fc8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IFileDialog
    {
        [PreserveSig] int Show(IntPtr parent);
        void SetFileTypes(uint cFileTypes, IntPtr rgFilterSpec);
        void SetFileTypeIndex(uint iFileType);
        void GetFileTypeIndex(out uint piFileType);
        void Advise(IntPtr pfde, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(uint fos);
        void GetOptions(out uint fos);
        void SetDefaultFolder(IShellItem psi);
        void SetFolder(IShellItem psi);
        void GetFolder(out IShellItem psi);
        void GetCurrentSelection(out IShellItem psi);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
        void GetResult(out IShellItem ppsi);
        void AddPlace(IShellItem psi, int fdap);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
        void Close(int hr);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter(IntPtr pFilter);
    }

    [ComImport]
    [Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItem
    {
        void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
        void GetParent(out IShellItem ppsi);
        void GetDisplayName(uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
        void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
        void Compare(IShellItem psi, uint hint, out int piOrder);
    }
}
'@
$path = [FolderPicker]::Pick('选择工作区')
if ($path) { [Console]::Out.Write((ConvertTo-Json -Compress -InputObject $path)) }
`;

export interface DirectoryPort {
  readonly requiresManualInput?: boolean;
  selectDirectory(): Promise<string | undefined>;
  validateDirectory(path: string): Promise<string>;
}

export type DirectoryExecFile = (
  file: string,
  args: readonly string[],
  options: { encoding: "utf8"; windowsHide: boolean; timeout: number },
) => Promise<{ stdout: string }>;

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
  constructor(private readonly exec: DirectoryExecFile = execFileAsync) {}

  async selectDirectory(): Promise<string | undefined> {
    let lastError: unknown;
    for (const executable of ["pwsh", "powershell.exe"]) {
      try {
        const { stdout } = await this.exec(
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
