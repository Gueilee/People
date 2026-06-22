@echo off
setlocal EnableDelayedExpansion

set "PROJETO=c:\SHP.old\OneDrive - Vendemmia\Documentos\02 - Gestão de Projetos\36 - Gestão de Pessoas"
set "PYTHON=%PROJETO%\backend\venv\Scripts\python.exe"
set PYTHONIOENCODING=utf-8

:: Gerar timestamp para log
for /f "tokens=1-3 delims=/" %%a in ("%date%") do set DT=%%c%%b%%a
for /f "tokens=1-2 delims=:." %%a in ("%time: =0%") do set HH=%%a%%b
set "LOGFILE=%PROJETO%\logs\sync-%DT%-%HH%.log"

echo. >> "%LOGFILE%"
echo ========================================= >> "%LOGFILE%"
echo  Vendemmia People - Sync Automatico >> "%LOGFILE%"
echo  %date% %time% >> "%LOGFILE%"
echo ========================================= >> "%LOGFILE%"

cd /d "%PROJETO%"

:: ---- 1. Convenia API ----
echo. >> "%LOGFILE%"
echo [1/3] Convenia API... >> "%LOGFILE%"
echo [1/3] Convenia API...
cd /d "%PROJETO%\backend"
"%PYTHON%" main.py >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Convenia falhou - codigo %errorlevel% >> "%LOGFILE%"
) else (
    echo [OK] Convenia concluido >> "%LOGFILE%"
)

:: ---- 2. Historico Cargos (Excel) ----
echo. >> "%LOGFILE%"
echo [2/3] ETL Historico... >> "%LOGFILE%"
echo [2/3] ETL Historico...
"%PYTHON%" etl_historico.py >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] ETL Historico falhou - codigo %errorlevel% >> "%LOGFILE%"
) else (
    echo [OK] ETL Historico concluido >> "%LOGFILE%"
)

:: ---- 3. TiqueTaque Ponto (mes atual) ----
echo. >> "%LOGFILE%"
echo [3/3] TiqueTaque Ponto (mes atual)... >> "%LOGFILE%"
echo [3/3] TiqueTaque Ponto (mes atual)...
cd /d "%PROJETO%"
for /f "tokens=1-2 delims=-" %%a in ('powershell -Command "Get-Date -Format yyyy-MM"') do set MESATUAL=%%a-%%b
for /f %%i in ('powershell -Command "Get-Date -Format yyyy-MM"') do set MESATUAL=%%i
"%PYTHON%" scripts\sync_ponto.py --mes %MESATUAL% >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] TiqueTaque falhou - codigo %errorlevel% >> "%LOGFILE%"
) else (
    echo [OK] TiqueTaque concluido >> "%LOGFILE%"
)

:: ---- 4. Git commit + push ----
echo. >> "%LOGFILE%"
echo [4/4] Atualizando deploy... >> "%LOGFILE%"
echo [4/4] Atualizando deploy...
cd /d "%PROJETO%"
git add frontend/database/vendemmia_people.db >> "%LOGFILE%" 2>&1
for /f %%i in ('powershell -Command "Get-Date -Format \"yyyy-MM-dd HH:mm\""') do set TIMESTAMP=%%i
git diff --cached --quiet
if %errorlevel% neq 0 (
    git commit -m "data: sync automatico %TIMESTAMP%" >> "%LOGFILE%" 2>&1
    git push >> "%LOGFILE%" 2>&1
    if %errorlevel% neq 0 (
        echo [ERRO] Git push falhou >> "%LOGFILE%"
    ) else (
        echo [OK] Deploy atualizado >> "%LOGFILE%"
    )
) else (
    echo [INFO] Sem alteracoes no banco - nada a commitar >> "%LOGFILE%"
)

:: ---- Limpar logs antigos (manter 30 dias) ----
forfiles /p "%PROJETO%\logs" /s /m "sync-*.log" /d -30 /c "cmd /c del @path" 2>nul

echo. >> "%LOGFILE%"
echo [DONE] Sync concluido em %date% %time% >> "%LOGFILE%"
echo [DONE] Sync concluido.
endlocal
