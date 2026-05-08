@echo off
title VENDEMMIA PEOPLE - Atualizar Dados
color 0B

echo.
echo ====================================================
echo   VENDEMMIA PEOPLE - Atualizando Dados
echo ====================================================
echo.

cd /d "%~dp0\backend"

echo [1/2] Buscando dados da API Convenia...
venv\Scripts\python.exe main.py

echo.
echo [2/2] Importando historico de cargos e salarios...
venv\Scripts\python.exe etl_historico.py

echo.
echo ====================================================
echo   Dados atualizados! Recarregue o dashboard.
echo ====================================================
echo.
pause
