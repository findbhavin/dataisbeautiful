@echo off
cd /d "%~dp0.."

set BRANCH=feat/light-theme-data-first
set REPO=findbhavin/dataisbeautiful

echo Committing...
git commit -m "feat: light theme, data-first design, multi-page layout, Others clarification"
if errorlevel 1 (
    echo Commit failed.
    exit /b 1
)

echo.
echo Pushing to origin %BRANCH%...
git push -u origin %BRANCH%
if errorlevel 1 (
    echo Push failed. Check your remote and credentials.
    exit /b 1
)

echo.
echo PR Link: https://github.com/%REPO%/compare/main...%BRANCH%?expand=1
