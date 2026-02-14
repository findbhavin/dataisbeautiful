@echo off
REM Push India map fix to fix/indiamap-map-analytics branch.
REM Run from Command Prompt OUTSIDE Cursor (avoids Git --trailer issues on older Git).
REM Usage: scripts\push_indiamap_fix.bat

set BRANCH=fix/indiamap-map-analytics
set BASE=indiamap
set REPO=findbhavin/dataisbeautiful

cd /d "%~dp0.."

echo Creating/checkout fix branch from indiamap...
git fetch origin indiamap
git checkout indiamap
git pull origin indiamap
git checkout -B %BRANCH%

echo.
echo Staging files...
git add static/js/map_semantic_zoom.js tests/test_india_map.py scripts/commit_push_indiamap_fix.bat scripts/test_india_map_container.bat scripts/push_indiamap_fix.bat

echo.
echo Status:
git status --short

echo.
echo Committing with --no-verify...
git commit --no-verify -m "fix: India map rendering - fitSize, container dimensions, path safety" -m "- Use fitSize for reliable India projection (fallback to manual scale)" -m "- Use container dimensions when available for correct aspect ratio" -m "- Path attr: handle null from geoPath to avoid invalid d" -m "- Add test_india_map.py: validate GeoJSON structure for D3 rendering" -m "- Add test_india_map_container.bat for Docker validation"
if errorlevel 1 (
    git commit --no-verify -m "fix: India map rendering - fitSize, container dimensions, path safety"
)
if errorlevel 1 (
    echo No changes to commit or commit failed. Run from Command Prompt OUTSIDE Cursor.
    exit /b 1
)

echo.
echo Pushing to origin %BRANCH%...
git push -u origin %BRANCH%
if errorlevel 1 (
    echo Push failed. Check remote and credentials.
    exit /b 1
)

echo.
echo Opening PR page (base: %BASE%)...
start https://github.com/%REPO%/compare/%BASE%...%BRANCH%?expand=1

echo.
echo Done. Create PR in browser, then deploy to GCP to verify.
