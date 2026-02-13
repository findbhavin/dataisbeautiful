@echo off
cd /d "%~dp0.."
git add -A
git status --short
echo.
git commit -m "feat: add analytics API, chart data, and charts.js for dashboard visualizations"
if errorlevel 1 exit /b 1
git push -u origin fix/map-visualization-permanent-fix
if errorlevel 1 exit /b 1
start https://github.com/findbhavin/dataisbeautiful/compare/main...fix/map-visualization-permanent-fix?expand=1
echo Done. PR page opened.
