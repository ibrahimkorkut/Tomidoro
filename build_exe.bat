@echo off
cd /d "%~dp0"
echo Starting build process...
echo Logs will be saved to build.log
echo Please wait, this may take a few minutes...
call npm run dist > build.log 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Build FAILED! See build.log for details.
    echo Last 20 lines of log:
    echo ----------------------------------------
    powershell -command "Get-Content build.log -Tail 20"
    echo ----------------------------------------
) else (
    echo.
    echo Build SUCCESS!
    echo Your executable is in:
    echo %~dp0dist_electron\win-unpacked\Tomidoro.exe
)
pause
