@echo off
echo ===================================================
echo   SmartEdu AI - Local App Runner
echo ===================================================
echo.
echo Adding local Node.js environment to PATH...
set PATH=C:\Users\krish\nd\node-v20.18.0-win-x64;%PATH%

echo.
echo Starting backend server and frontend client...
echo ===================================================
call npm run dev
echo.
pause
