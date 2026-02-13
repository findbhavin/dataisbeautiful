@echo off
REM Run this from the repo root (dataisbeautiful) in Command Prompt or PowerShell.
REM Commit, push, and open the GitHub PR page.

set BRANCH=fix/map-visualization-permanent-fix
set REPO=findbhavin/dataisbeautiful

cd /d "%~dp0.."

echo Checking branch...
git branch --show-current
if errorlevel 1 exit /b 1

echo.
echo Committing...
git commit -m "fix: permanent map visualization for all environments"
if errorlevel 1 (
    echo Commit failed. If you see "unknown option trailer", run this script from a normal Command Prompt or PowerShell outside Cursor.
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
echo Opening GitHub PR page...
start https://github.com/%REPO%/compare/main...%BRANCH%?expand=1

echo.
echo Done. In the opened browser: add title and paste content from PR_DESCRIPTION.md, then click Create pull request.
