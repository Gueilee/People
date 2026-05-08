@echo off
title VENDEMMIA PEOPLE - Servidor
color 0A

echo.
echo ====================================================
echo   VENDEMMIA PEOPLE - Iniciando Sistema
echo ====================================================
echo.

cd /d "%~dp0"

:: Verificar se o banco existe, se nao, rodar o ETL
if not exist "database\vendemmia_people.db" (
    echo [INFO] Banco de dados nao encontrado. Executando ETL...
    cd backend
    venv\Scripts\python.exe main.py
    venv\Scripts\python.exe etl_historico.py
    cd ..
)

:: Verificar se o build de producao existe
if not exist "frontend\.next\standalone\server.js" (
    echo [INFO] Build de producao nao encontrado. Compilando...
    cd frontend
    call npm run build
    cd ..
)

:: Copiar arquivos estaticos para o standalone (necessario apos build)
echo [INFO] Preparando arquivos...
xcopy /E /Y /I "frontend\.next\static" "frontend\.next\standalone\.next\static" > nul 2>&1
xcopy /E /Y /I "frontend\public"       "frontend\.next\standalone\public"       > nul 2>&1

echo.
echo [OK] Iniciando servidor na porta 3001...
echo [OK] Acesse: http://localhost:3001/dashboard
echo [OK] Para parar: feche esta janela ou pressione Ctrl+C
echo.

set PORT=3001
node "frontend\.next\standalone\server.js"

pause
