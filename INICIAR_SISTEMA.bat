@echo off
title Sistema Toca do Lobo
echo ======================================================
echo           SISTEMA TOCA DO LOBO - INICIANDO
echo ======================================================
echo.
echo Porta 8000: Painel Administrativo / Caixa
echo Porta 8888: Cardapio Digital para Clientes
echo.
echo Mantenha esta janela aberta enquanto usar o sistema.
echo ======================================================
echo.
python TOCADOLOBO/backend/main.py
pause
