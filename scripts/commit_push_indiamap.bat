@echo off
cd /d "%~dp0.."
echo Staging India map files...
git add README.md app/routers/analytics.py app/routers/geo.py app/routers/mobile.py app/services/india_data_loader.py
git add static/css/glassmorphism.css static/js/custom_maps.js static/js/map_semantic_zoom.js templates/index.html
git add data/india/ scripts/download_india_geojson.py scripts/commit_push_indiamap.bat
echo Committing...
git commit -m "Add India map support with TRAI/GSMA mobile data in INR" -m "- Country selector (US/India) in header" -m "- India state-level mobile data (Jio, Airtel, Vi, BSNL) in Cr" -m "- India GeoJSON, city coords, data center tiers, hub pairs" -m "- Run scripts/download_india_geojson.py for state boundaries"
if errorlevel 1 (
    echo Commit failed. Trying simple message...
    git commit -m "Add India map support with TRAI mobile data in INR"
)
if errorlevel 1 (
    echo Commit failed. Check git status.
    exit /b 1
)
echo Pushing to indiamap branch...
git push -u origin indiamap
if errorlevel 1 (
    echo Push failed. You may need to push manually: git push -u origin indiamap
    exit /b 1
)
echo Done. India map changes committed and pushed to indiamap branch.
