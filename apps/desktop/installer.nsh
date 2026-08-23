; 每用户安装：探测目录可写。失败只提示，不抬 UAC。
; 默认目录由 electron-builder 每用户模式设为 %LOCALAPPDATA%\Programs\pig。不要改 appId。

!macro customHeader
  LangString DIR_NOT_WRITABLE ${LANG_SIMPCHINESE} "请选择当前用户可写的目录（不要选 Program Files）。"
  LangString DIR_NOT_WRITABLE ${LANG_ENGLISH} "Please choose a folder your account can write to (not Program Files)."
!macroend

; 不要出现「所有用户」页，也不要为它抬 UAC。
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

Function .onVerifyInstDir
  ClearErrors
  CreateDirectory "$INSTDIR"
  IfErrors pigDirNotWritable
  FileOpen $0 "$INSTDIR\pig-inst-write-test.tmp" w
  IfErrors pigDirNotWritable
  FileClose $0
  Delete "$INSTDIR\pig-inst-write-test.tmp"
  Return
pigDirNotWritable:
  MessageBox MB_ICONEXCLAMATION "$(DIR_NOT_WRITABLE)"
  Abort
FunctionEnd
