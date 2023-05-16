@echo off
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "& './Makefile.ps1'; run_local"
pause
