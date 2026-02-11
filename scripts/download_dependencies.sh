#!/bin/bash

set -e  # Exit on error

echo "================================================"
echo "Downloading D3.js and TopoJSON Dependencies"
echo "================================================"

# Create directories if they don't exist
mkdir -p static/js
mkdir -p data/topojson

# Download D3.js v7
echo ""
echo "📦 Downloading D3.js v7..."
curl -L "https://unpkg.com/d3@7/dist/d3.min.js" -o "static/js/d3.min.js" --progress-bar
if [ -f "static/js/d3.min.js" ]; then
    SIZE=$(du -h static/js/d3.min.js | cut -f1)
    echo "✓ D3.js downloaded successfully ($SIZE)"
else
    echo "✗ Failed to download D3.js"
    exit 1
fi

# Download TopoJSON
echo ""
echo "📦 Downloading TopoJSON v3..."
curl -L "https://unpkg.com/topojson@3/dist/topojson.min.js" -o "static/js/topojson.min.js" --progress-bar
if [ -f "static/js/topojson.min.js" ]; then
    SIZE=$(du -h static/js/topojson.min.js | cut -f1)
    echo "✓ TopoJSON downloaded successfully ($SIZE)"
else
    echo "✗ Failed to download TopoJSON"
    exit 1
fi

# Download US Topology Data (if needed)
echo ""
echo "📦 Downloading US Topology Data..."
TOPOJSON_DIR="data/topojson"

# Check if file exists and is valid
if [ -f "$TOPOJSON_DIR/us_states.topo.json" ]; then
    FILE_SIZE=$(wc -c < "$TOPOJSON_DIR/us_states.topo.json")
    if [ "$FILE_SIZE" -gt 50000 ]; then
        echo "✓ US States topology already exists and looks valid ($FILE_SIZE bytes)"
    else
        echo "⚠ Existing file is too small ($FILE_SIZE bytes) - downloading new copy..."
        curl -L "https://d3js.org/us-10m.v1.json" -o "$TOPOJSON_DIR/us_states.topo.json" --progress-bar
    fi
else
    echo "Downloading from https://d3js.org/us-10m.v1.json..."
    curl -L "https://d3js.org/us-10m.v1.json" -o "$TOPOJSON_DIR/us_states.topo.json" --progress-bar
fi

# Validate file was downloaded and is not empty
if [ ! -s "$TOPOJSON_DIR/us_states.topo.json" ]; then
    echo "❌ ERROR: Failed to download US topology data"
    exit 1
fi

# Check file size (should be at least 50KB for valid topology)
FILE_SIZE=$(wc -c < "$TOPOJSON_DIR/us_states.topo.json")
if [ "$FILE_SIZE" -lt 50000 ]; then
    echo "❌ ERROR: Downloaded topology file is too small (${FILE_SIZE} bytes) - may be placeholder or download failed"
    echo "Expected file size: ~60-70KB"
    exit 1
fi

echo "✓ US topology data downloaded successfully (${FILE_SIZE} bytes)"

# Verify downloads
echo ""
echo "================================================"
echo "Verification"
echo "================================================"
ls -lh static/js/d3.min.js static/js/topojson.min.js 2>/dev/null || echo "Some files missing!"
echo ""
echo "✅ Download complete! Your app should now work offline."
echo ""
echo "To use these files, make sure your HTML loads from local paths:"
echo '  <script src="/static/js/d3.min.js"></script>'
echo '  <script src="/static/js/topojson.min.js"></script>'
echo ""
