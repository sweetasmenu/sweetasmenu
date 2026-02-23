@echo off
echo ========================================
echo   SweetAsMenu - Print Agent Launcher
echo ========================================
echo.
echo Starting Chrome with auto-print mode...
echo   --kiosk-printing  = skip print dialog
echo   --disable-popup-blocking = allow print windows
echo.
echo NOTE: Set POS80 as your DEFAULT printer in Windows Settings first!
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --disable-popup-blocking "https://sweetasmenu.com/pos/print-agent"

echo Chrome started. You can close this window.
pause
