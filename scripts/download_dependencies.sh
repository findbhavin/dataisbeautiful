#!/bin/bash

set -e  # Exit on error

# Constants for file size validation
MIN_FILE_SIZE=10000        # Minimum valid file size (10KB)
FULL_RES_THRESHOLD=50000   # Threshold for full-resolution data (50KB)

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
    if [ "$FILE_SIZE" -gt "$FULL_RES_THRESHOLD" ]; then
        echo "✓ US States topology already exists and looks valid ($FILE_SIZE bytes)"
    else
        echo "⚠ Existing file is simplified topology ($FILE_SIZE bytes) - downloading full-resolution data..."
        curl -L "https://d3js.org/us-10m.v1.json" -o "$TOPOJSON_DIR/us_states.topo.json" --progress-bar
        
        # Check if download succeeded
        NEW_SIZE=$(wc -c < "$TOPOJSON_DIR/us_states.topo.json")
        if [ "$NEW_SIZE" -gt "$FULL_RES_THRESHOLD" ]; then
            echo "✓ Full-resolution US topology data downloaded successfully ($NEW_SIZE bytes)"
        else
            echo "⚠ Warning: Download may have failed. File size is only $NEW_SIZE bytes."
            echo "   The existing simplified topology will be used as fallback."
        fi
    fi
else
    echo "Downloading from https://d3js.org/us-10m.v1.json..."
    curl -L "https://d3js.org/us-10m.v1.json" -o "$TOPOJSON_DIR/us_states.topo.json" --progress-bar
    
    # Validate download
    FILE_SIZE=$(wc -c < "$TOPOJSON_DIR/us_states.topo.json")
    if [ "$FILE_SIZE" -lt "$MIN_FILE_SIZE" ]; then
        echo "❌ ERROR: Failed to download US topology data (file too small: ${FILE_SIZE} bytes)"
        exit 1
    fi
fi

# Final validation
if [ ! -s "$TOPOJSON_DIR/us_states.topo.json" ]; then
    echo "❌ ERROR: US topology data file is missing or empty"
    exit 1
fi

FILE_SIZE=$(wc -c < "$TOPOJSON_DIR/us_states.topo.json")
if [ "$FILE_SIZE" -lt "$MIN_FILE_SIZE" ]; then
    echo "❌ ERROR: Topology file is too small (${FILE_SIZE} bytes)"
    exit 1
elif [ "$FILE_SIZE" -lt "$FULL_RES_THRESHOLD" ]; then
    echo "⚠ Using simplified topology (${FILE_SIZE} bytes)"
    echo "   For production use with detailed state boundaries, ensure internet access"
    echo "   and re-run this script to download full-resolution data (~60-70KB)"
else
    echo "✓ US topology data ready (${FILE_SIZE} bytes)"
fi

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
