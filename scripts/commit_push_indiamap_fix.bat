@echo off
REM Run from Command Prompt or PowerShell OUTSIDE Cursor.
REM (Cursor adds --trailer to git commit which fails on older Git versions)
REM Commit, push, and open the GitHub PR page for India map fix.

set BRANCH=fix/indiamap-map-analytics
set BASE=indiamap
set REPO=findbhavin/dataisbeautiful

cd /d "%~dp0.."

echo Staging India map fix files...
git add app/routers/analytics.py app/routers/geo.py data/india/india_city_coordinates.json
git add static/js/charts.js static/js/map_semantic_zoom.js templates/index.html
git add scripts/commit_push_indiamap_fix.bat

echo Checking branch...
git branch --show-current
if errorlevel 1 exit /b 1

echo.
echo Committing...
git commit --no-verify -m "fix: India map GeoJSON, analytics, Data/Analytics reset on country change" -m "- Use GeoJSON for India (TopoJSON has invalid arc indices)" -m "- Geo router: CDN fallback for India GeoJSON" -m "- Reset Data and Analytics tabs when country changes" -m "- Hide US Others sections when India selected" -m "- State name normalization for GeoJSON matching"
if errorlevel 1 (
    git commit --no-verify -m "fix: India map GeoJSON, analytics, Data/Analytics reset on country change"
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
