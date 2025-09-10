@echo off
if "%1"=="" (
    echo Usage: update-version.bat ^<new-version^>
    echo Example: update-version.bat 0.3.1
    exit /b 1
)

set NEW_VERSION=%1
echo Updating version to %NEW_VERSION%...

REM Update using Node.js script
node update-version.js %NEW_VERSION%

if %ERRORLEVEL% neq 0 (
    echo Failed to update version
    exit /b 1
)

echo.
echo Version updated successfully!
echo To release, run:
echo   git add .
echo   git commit -m "bump version to %NEW_VERSION%"
echo   git push
