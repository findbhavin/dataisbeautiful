@echo off
REM Run from Command Prompt or PowerShell OUTSIDE Cursor.
REM (Cursor adds --trailer to git commit which fails on older Git versions)
REM Commit, push, and open the GitHub PR page for India map fix.

set BRANCH=fix/indiamap-map-analytics
set BASE=indiamap
set REPO=findbhavin/dataisbeautiful

cd /d "%~dp0.."

echo Creating/checkout fix branch...
git checkout -B fix/indiamap-map-analytics

echo Staging India map fix files...
git add app/routers/geo.py static/js/custom_maps.js static/js/map_semantic_zoom.js
git add scripts/commit_push_indiamap_fix.bat scripts/download_india_geojson_with_pok.py

echo Checking branch...
git branch --show-current
if errorlevel 1 exit /b 1

echo.
echo Committing...
git commit --no-verify -m "fix: India map POK, Unknown tooltip, India state lookup" -m "- Include POK (Pakistan-occupied Kashmir) in India map via datameet GeoJSON" -m "- Fix Unknown/No data center: use NAME_1 for India, India state key lookup" -m "- Tooltip for India regions without data (e.g. POK)" -m "- India state support in Data Centers paste (custom_maps)" -m "- Script: download_india_geojson_with_pok.py"
if errorlevel 1 (
    git commit --no-verify -m "fix: India map POK, Unknown tooltip, India state lookup"
)
if errorlevel 1 (
    echo Commit failed. Run this from Command Prompt OUTSIDE Cursor.
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
echo Opening GitHub PR page (base: %BASE%)...
start https://github.com/%REPO%/compare/%BASE%...%BRANCH%?expand=1

echo.
echo Done. In the opened browser: add title/description if needed, then click Create pull request.
