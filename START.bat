@echo off
echo =============================================
echo    Popup Video Player - Setup
echo =============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install --silent

echo.
echo Starting Popup Video Player...
echo The app will start MINIMIZED.
echo It will pop up randomly every 30-300 seconds!
echo.
echo To close the app, use Task Manager (Ctrl+Shift+Esc)
echo.

call npm start
