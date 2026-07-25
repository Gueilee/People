@echo off
chcp 1252 > nul
setlocal EnableDelayedExpansion

:: Deriva o caminho do proprio script (sem acentuacao hardcoded)
set "PROJETO=%~dp0"
if "%PROJETO:~-1%"=="\" set "PROJETO=%PROJETO:~0,-1%"

set "PYTHON=%PROJETO%\backend\venv\Scripts\python.exe"
set PYTHONIOENCODING=utf-8

:: Garante que o diretorio de logs existe
if not exist "%PROJETO%\logs" mkdir "%PROJETO%\logs"

:: Gerar timestamp para log
for /f "tokens=1-3 delims=/" %%a in ("%date%") do (
    set DD=%%a & set MM=%%b & set AAAA=%%c
)
for /f "tokens=1-2 delims=:." %%a in ("%time: =0%") do set HH=%%a%%b
set "LOGFILE=%PROJETO%\logs\sync-%AAAA%%MM%%DD%-%HH%.log"

echo. >> "%LOGFILE%"
echo ========================================= >> "%LOGFILE%"
echo  Vendemmia People - Sync Automatico >> "%LOGFILE%"
echo  %date% %time% >> "%LOGFILE%"
echo ========================================= >> "%LOGFILE%"

:: ---- 1. Convenia API ----
echo. >> "%LOGFILE%"
echo [1/3] Convenia API... >> "%LOGFILE%"
echo [1/3] Convenia API...
cd /d "%PROJETO%\backend"
"%PYTHON%" -u main.py >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Convenia falhou - codigo %errorlevel% >> "%LOGFILE%"
    echo [ERRO] Convenia falhou
) else (
    echo [OK] Convenia concluido >> "%LOGFILE%"
    echo [OK] Convenia concluido
)

:: ---- 2. Historico Cargos (API Convenia) ----
echo. >> "%LOGFILE%"
echo [2/3] Historico Cargos e Salarios (API)... >> "%LOGFILE%"
echo [2/3] Historico Cargos e Salarios (API)...
"%PYTHON%" -u sync_historico.py >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Historico falhou - codigo %errorlevel% >> "%LOGFILE%"
    echo [ERRO] Historico falhou
) else (
    echo [OK] Historico concluido >> "%LOGFILE%"
    echo [OK] Historico concluido
)

:: ---- 3. TiqueTaque Ponto (mes anterior + mes atual) ----
echo. >> "%LOGFILE%"
echo [3/3] TiqueTaque Ponto (2 meses)... >> "%LOGFILE%"
echo [3/3] TiqueTaque Ponto (2 meses)...
cd /d "%PROJETO%"
for /f %%i in ('powershell -Command "Get-Date -Format yyyy-MM"') do set MESATUAL=%%i
for /f %%i in ('powershell -Command "(Get-Date).AddMonths(-1).ToString('yyyy-MM')"') do set MESANTERIOR=%%i
"%PYTHON%" -u scripts\sync_ponto.py --de %MESANTERIOR% --ate %MESATUAL% >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] TiqueTaque falhou - codigo %errorlevel% >> "%LOGFILE%"
    echo [ERRO] TiqueTaque falhou
) else (
    echo [OK] TiqueTaque concluido >> "%LOGFILE%"
    echo [OK] TiqueTaque concluido
)

:: ---- Limpar logs antigos (manter 30 dias) ----
forfiles /p "%PROJETO%\logs" /s /m "sync-*.log" /d -30 /c "cmd /c del @path" 2>nul

echo. >> "%LOGFILE%"
echo [DONE] Sync concluido em %date% %time% >> "%LOGFILE%"
echo [DONE] Sync concluido.
endlocal
