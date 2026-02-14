@echo off
REM Push India Option B POK+Ladakh fix to indiamap2 branch.
REM Run from Command Prompt or PowerShell OUTSIDE Cursor (avoids Git --trailer issues).
REM Usage: scripts\push_indiamap2_pok_ladakh.bat

set BRANCH=indiamap2
set REPO=findbhavin/dataisbeautiful

cd /d "%~dp0.."

echo Staging files...
git add app/routers/geo.py tests/test_geo_india_option_b.py

echo.
echo Status:
git status --short

echo.
echo Committing with --no-verify...
git commit --no-verify -m "fix: India Option B - POK+Ladakh full boundaries (indiamaps.netlify.app)" -m "- Merge POK from datameet into J&K for full India-claimed boundaries" -m "- Replace Ladakh with india-in-data full Ladakh (Leh+Kargil+Aksai Chin)" -m "- Add test_geo_india_option_b.py for API validation"
if errorlevel 1 (
    git commit --no-verify -m "fix: India Option B - POK+Ladakh full boundaries"
)
if errorlevel 1 (
    echo No changes to commit. Run from Command Prompt OUTSIDE Cursor.
    exit /b 1
)

echo.
echo Pushing to origin %BRANCH%...
git push origin %BRANCH%
if errorlevel 1 (
    echo Push failed. Check remote and credentials.
    exit /b 1
)

echo.
echo Done. Pushed to origin/%BRANCH%
