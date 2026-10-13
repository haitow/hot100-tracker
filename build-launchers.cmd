@echo off
setlocal
set "launcherCompiler=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%launcherCompiler%" set "launcherCompiler=%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%launcherCompiler%" (
  echo The Windows .NET Framework C# compiler was not found.
  exit /b 1
)
"%launcherCompiler%" /nologo /target:winexe /platform:anycpu /optimize+ /reference:System.Windows.Forms.dll /out:"%~dp0start.exe" "%~dp0launcher\Launcher.cs"
if errorlevel 1 exit /b 1
"%launcherCompiler%" /nologo /target:winexe /platform:anycpu /optimize+ /define:STOP_ENTRY /reference:System.Windows.Forms.dll /out:"%~dp0stop.exe" "%~dp0launcher\Launcher.cs"
if errorlevel 1 exit /b 1
echo Built start.exe and stop.exe. Double-click start.exe for normal use.
