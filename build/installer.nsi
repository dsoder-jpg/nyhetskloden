; Nyhetskloden – installasjonsprogram (NSIS)
; Bygg: makensis -DVERSION=3.0.0 -DSRC=dist\Nyhetskloden-win32-x64 build/installer.nsi
; Installerer per bruker (krever ikke administrator), lager snarveier og avinstallerer rent.
; Kjøres det med /S (stille), startes appen igjen etterpå – det brukes av den innebygde oppdateringen.

Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef SRC
  !define SRC "..\dist\Nyhetskloden-win32-x64"
!endif
!define APP "Nyhetskloden"
!define EXE "Nyhetskloden.exe"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}"

Name "${APP}"
OutFile "..\dist\installer\Nyhetskloden-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${APP}"
InstallDirRegKey HKCU "Software\${APP}" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "${APP} ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APP}"
VIAddVersionKey "FileDescription" "${APP} installasjon"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Daniel"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Installer ${APP} ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Nyhetskloden viser nyheter fra hele verden på en 3D-klode, oppdatert hvert 5. minutt.$\r$\n$\r$\nAppen installeres bare for deg og trenger ikke administratorrettigheter."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Start Nyhetskloden nå"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Norwegian"

Function .onInit
  ; lukk en kjørende versjon før filene byttes ut
  nsExec::Exec 'taskkill /IM "${EXE}" /F'
  Sleep 800
FunctionEnd

Section "Nyhetskloden" SecMain
  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  File /r "${SRC}\*.*"
  WriteUninstaller "$INSTDIR\Avinstaller Nyhetskloden.exe"

  CreateDirectory "$SMPROGRAMS\${APP}"
  CreateShortcut "$SMPROGRAMS\${APP}\${APP}.lnk" "$INSTDIR\${EXE}"
  CreateShortcut "$SMPROGRAMS\${APP}\Avinstaller ${APP}.lnk" "$INSTDIR\Avinstaller Nyhetskloden.exe"
  IfSilent +2
  CreateShortcut "$DESKTOP\${APP}.lnk" "$INSTDIR\${EXE}"

  WriteRegStr HKCU "Software\${APP}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "Daniel"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Avinstaller Nyhetskloden.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Avinstaller Nyhetskloden.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"

  ; stille oppdatering: start appen igjen når den er ferdig, med mindre /norun er gitt
  IfSilent 0 skiprun
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/norun" $R1
  IfErrors 0 skiprun
  Exec '"$INSTDIR\${EXE}"'
  skiprun:
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM "${EXE}" /F'
  Sleep 800
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\${APP}.lnk"
  RMDir /r "$SMPROGRAMS\${APP}"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\${APP}"
  ; innstillinger og lagrede saker i %APPDATA%\Nyhetskloden blir liggende med vilje
SectionEnd
