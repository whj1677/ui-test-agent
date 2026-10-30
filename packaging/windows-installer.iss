#ifndef SourceDir
  #error SourceDir is required
#endif
#ifndef ReleaseDir
  #error ReleaseDir is required
#endif
[Setup]
AppId={{ACB05159-C0F8-4B5B-8E57-6F734FA1A2AC}
AppName=测试工作台
AppVersion=0.1.0
AppPublisher=Test Workbench
DefaultDirName={localappdata}\UITestAgent
DefaultGroupName=测试工作台
UsePreviousAppDir=yes
UsePreviousGroup=yes
UsePreviousTasks=yes
DisableDirPage=no
DisableProgramGroupPage=yes
DisableWelcomePage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
Compression=lzma2/fast
SolidCompression=no
OutputDir={#ReleaseDir}
OutputBaseFilename=UITestAgent-Setup
UninstallFilesDir={app}\uninstall
UninstallDisplayIcon={app}\program\runtime\node\node.exe
; Restart Manager identifies holders of the exact installed file resources.
; Force permits termination of an unresponsive old process, never by image name.
CloseApplications=force
CloseApplicationsFilter=*.exe,*.dll
RestartApplications=no
SetupLogging=yes
[Languages]
Name: "chinesesimplified"; MessagesFile: "ChineseSimplified.isl"
[Tasks]
Name: "desktopicon"; Description: "创建桌面“启动测试工作台”快捷方式"; GroupDescription: "快捷方式："; Flags: checkedonce
[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}\program"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\启动测试工作台"; Filename: "{app}\program\runtime\node\node.exe"; Parameters: """{app}\program\workbench\scripts\native-entry.mjs"" launch"; WorkingDir: "{app}\program"; Flags: runminimized
Name: "{autodesktop}\启动测试工作台"; Filename: "{app}\program\runtime\node\node.exe"; Parameters: """{app}\program\workbench\scripts\native-entry.mjs"" launch"; WorkingDir: "{app}\program"; Tasks: desktopicon; Flags: runminimized
[Run]
Filename: "{app}\program\runtime\node\node.exe"; Parameters: """{app}\program\workbench\scripts\native-entry.mjs"" launch"; WorkingDir: "{app}\program"; Description: "打开测试工作台"; Flags: nowait postinstall skipifsilent runminimized
[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if Length(ExpandConstant('{app}\program')) + 180 > 240 then
    Result := '安装位置过长，请选择较短的位置，例如 D:\测试工作台。'
  ;
end;
function InitializeUninstall(): Boolean;
var
  Request: Variant;
begin
  Result := True;
  try
    Request := CreateOleObject('WinHttp.WinHttpRequest.5.1');
    Request.SetTimeouts(1000, 1000, 1000, 1000);
    Request.Open('GET', 'http://127.0.0.1:4322/api/health', False);
    Request.Send();
    Result := False;
  except
    Result := True;
  end;
  if not Result then
    MsgBox('工作台仍在运行。请先正常停止工作台再卸载；项目和密钥将保留。', mbError, MB_OK);
end;
