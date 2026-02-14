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
git add static/js/map_semantic_zoom.js tests/test_india_map.py scripts/commit_push_indiamap_fix.bat

echo Checking branch...
git branch --show-current
if errorlevel 1 exit /b 1

echo.
echo Committing...
git commit --no-verify -m "fix: India map rendering - fitSize, container dimensions, path safety" -m "- Use fitSize for reliable India projection (fallback to manual scale)" -m "- Use container dimensions when available for correct aspect ratio" -m "- Path attr: handle null from geoPath to avoid invalid d" -m "- Add test_india_map.py: validate GeoJSON structure for D3 rendering"
if errorlevel 1 (
    git commit --no-verify -m "fix: India map rendering - fitSize, container dimensions, path safety"
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
