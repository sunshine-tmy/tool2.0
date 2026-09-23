; Writable per-user install directory and explicit, opt-in data deletion.
!ifndef BUILD_UNINSTALLER
  Var DesktopInstallWriteTest
  Var DesktopInstallPathLabel
  !include "nsDialogs.nsh"
!endif

!ifndef BUILD_UNINSTALLER
  !macro customPageAfterChangeDir
    Page custom DesktopInstallPathPageCreate DesktopInstallPathPageLeave
  !macroend

  Function DesktopInstallPathPageCreate
    StrLen $0 $INSTDIR
    StrLen $1 "${APP_FILENAME}"
    IntCmp $0 $1 desktopAppendProductFolder desktopCheckProductFolderSuffix desktopCheckProductFolderSuffix
    desktopCheckProductFolderSuffix:
      IntOp $2 $0 - $1
      StrCpy $3 $INSTDIR $1 $2
      StrCmp $3 "${APP_FILENAME}" desktopProductFolderReady
    desktopAppendProductFolder:
      StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
    desktopProductFolderReady:

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateLabel} 0 0 100% 30u "安装程序将使用以下最终目录。为避免提权后程序目录与用户数据权限不一致，此目录必须可由当前用户写入。"
    Pop $0
    ${NSD_CreateLabel} 0 42u 100% 46u "$INSTDIR"
    Pop $DesktopInstallPathLabel
    nsDialogs::Show
  FunctionEnd

  Function DesktopInstallPathPageLeave
    CreateDirectory "$INSTDIR"
    ClearErrors
    GetTempFileName $DesktopInstallWriteTest "$INSTDIR"
    IfErrors desktopInstallPathNotWritable
    Delete "$DesktopInstallWriteTest"
    Return

    desktopInstallPathNotWritable:
      MessageBox MB_ICONSTOP|MB_OK "当前用户无法写入所选目录：$INSTDIR。请选择其他目录。此版本不支持安装到需要管理员权限的受保护目录。"
      Abort
  FunctionEnd
!endif

!macro customUnInstall
  ${If} ${Silent}
    ; Silent uninstall always preserves the full data root.
  ${ElseIf} ${isUpdated}
    ; Upgrades must never ask to delete data.
  ${Else}
    MessageBox MB_ICONEXCLAMATION|MB_YESNO|MB_DEFBUTTON2 "是否同时删除此应用管理的全部数据？包括数据库、作品与历史、素材、能力包、模型、浏览器登录状态、日志和备份。选择‘否’会保留 data 目录。" IDNO preserveDesktopData
    MessageBox MB_ICONSTOP|MB_YESNO|MB_DEFBUTTON2 "再次确认：删除后无法通过重新安装恢复这些数据。确定永久删除吗？" IDNO preserveDesktopData
    RMDir /r "$INSTDIR\data"
    ReadEnvStr $0 "LOCALAPPDATA"
    ${If} $0 != ""
      RMDir /r "$0\EcommerceToolboxData"
    ${EndIf}
    Goto desktopDataDecisionComplete
    preserveDesktopData:
      DetailPrint "Keeping application data at $INSTDIR\data"
    desktopDataDecisionComplete:
  ${EndIf}
!macroend

!macro customRemoveFiles
  SetOutPath "$TEMP"
  ; @@GENERATED_PROGRAM_FILE_REMOVALS@@
  Delete /REBOOTOK "$INSTDIR\uninstallerIcon.ico"
  Delete /REBOOTOK "$INSTDIR\${UNINSTALL_FILENAME}"
  Delete /REBOOTOK "$INSTDIR\install.log"
  RMDir "$INSTDIR"
!macroend
