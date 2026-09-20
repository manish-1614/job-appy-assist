@echo off
REM =========================================================================
REM JobAppy Assist - Windows Task Scheduler Automated Registration Script
REM Runs twice daily at 09:00 and 21:00 IST with missed-start recovery.
REM =========================================================================

echo [JobAppy Assist] Registering Windows Scheduled Tasks...

set TASK_NAME_MORNING=JobAppyAssist_MorningScan
set TASK_NAME_EVENING=JobAppyAssist_EveningScan
set PROJECT_DIR=%~dp0..
set SCAN_CMD=cmd.exe /c "cd /d %PROJECT_DIR% && pnpm scan >> data\scan.log 2>&1"

echo Project Directory: %PROJECT_DIR%

REM Register Morning Scan at 09:00 AM daily
schtasks /create /tn "%TASK_NAME_MORNING%" /tr "%SCAN_CMD%" /sc daily /st 09:00 /f
if %ERRORLEVEL% EQU 0 (
    echo [OK] Morning scan task created successfully at 09:00.
) else (
    echo [WARNING] Failed to create morning task. Please run cmd as Administrator if required.
)

REM Register Evening Scan at 09:00 PM daily
schtasks /create /tn "%TASK_NAME_EVENING%" /tr "%SCAN_CMD%" /sc daily /st 21:00 /f
if %ERRORLEVEL% EQU 0 (
    echo [OK] Evening scan task created successfully at 21:00.
) else (
    echo [WARNING] Failed to create evening task. Please run cmd as Administrator if required.
)

echo.
echo [JobAppy Assist] Task Scheduler configuration complete.
echo To verify registered tasks: schtasks /query /tn JobAppyAssist_*
