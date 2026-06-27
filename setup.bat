@echo off
echo ===================================================
echo   SmartEdu AI - Local Environment Setup Script
echo ===================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/ and restart your terminal.
    echo.
    pause
    exit /b 1
)

echo [1/4] Installing root dependencies...
call npm install

echo [2/4] Installing client and server dependencies...
call npm run install:all

echo [3/4] Creating environment configuration (.env files)...
if not exist server\.env (
    copy server\.env.example server\.env
    echo Created server\.env
) else (
    echo server\.env already exists.
)

if not exist .env (
    copy .env.example .env
    echo Created root .env
) else (
    echo root .env already exists.
)

echo [4/4] Syncing and seeding database...
call npm run seed

echo.
echo ===================================================
echo   Setup Complete!
echo   Run "npm run dev" to start the client and server.
echo ===================================================
echo.
pause
