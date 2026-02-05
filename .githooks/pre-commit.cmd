@echo off
setlocal
cd /d "%~dp0.."
npx lint-staged
