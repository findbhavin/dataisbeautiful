@echo off
REM Test India map in Docker container before deploying to GCP.
REM Run from project root. Requires Docker.
REM Usage: scripts\test_india_map_container.bat

cd /d "%~dp0.."

echo Building Docker image...
docker build -t mapvisual-india:test .
if errorlevel 1 (
    echo Docker build failed.
    exit /b 1
)

echo.
echo Starting container on port 8080...
docker run -d -p 8080:8080 --name mapvisual-test mapvisual-india:test
if errorlevel 1 (
    echo Docker run failed. Is port 8080 in use?
    exit /b 1
)

echo.
echo Waiting for app to start...
timeout /t 5 /nobreak > nul

echo.
echo Testing India GeoJSON API...
curl -s http://localhost:8080/api/geo/india/geojson/states > test_india_geojson.json 2>nul
findstr /C:"FeatureCollection" test_india_geojson.json > nul 2>nul
if errorlevel 1 (
    echo India GeoJSON API test FAILED - check if app is running
) else (
    echo India GeoJSON API returned valid FeatureCollection
)
del test_india_geojson.json 2>nul

echo.
echo Stopping container...
docker stop mapvisual-test
docker rm mapvisual-test

echo.
echo Done. Open http://localhost:8080 and select India from Map dropdown to verify rendering.
