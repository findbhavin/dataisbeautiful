@echo off
cd /d "%~dp0.."
git commit -m "feat: metros stacked bars, map Others clarification, data table pre/post, revenue label, top states operator selector"
if errorlevel 1 exit /b 1
git push -u origin feat/light-theme-data-first
echo.
echo PR: https://github.com/findbhavin/dataisbeautiful/compare/main...feat/light-theme-data-first?expand=1
