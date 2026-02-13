# Fix: Permanent map visualization for all environments

## Problem
The map showed a grey canvas with only a few shapes and scattered labels because:
1. The repo’s `us_states.topo.json` is a **simplified placeholder** (~24KB) where each state is a single tiny polygon.
2. In Docker, **COPY data/** ran after copying the builder’s topology, so the placeholder **overwrote** the good file in the image.
3. The CDN fallback used `d3js.org/us-10m.v1.json`, which is counties-focused and may not expose `objects.states`.

## Solution
- **Dockerfile:** Copy repo `data/` first, then overwrite only `us_states.topo.json` from the builder so the image uses full state boundaries and keeps the repo’s counties file.
- **Download script:** Use **us-atlas states-10m** (`https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json`) and a 20KB threshold so the placeholder is always replaced when the script runs.
- **Frontend:** CDN fallback URL set to the same us-atlas states-10m URL so the fallback always has `objects.states`.
- **TROUBLESHOOTING.md:** New section for “grey map / few shapes” and updated manual curl to the states-10m URL.

## Testing
- Rebuild the Docker image and deploy; the map should show full US state boundaries.
- Locally, run `./scripts/download_dependencies.sh` once if the map was broken; otherwise the CDN fallback will load when the API is unavailable.

## Files changed
- `Dockerfile`
- `scripts/download_dependencies.sh`
- `static/js/map_semantic_zoom.js`
- `TROUBLESHOOTING.md`
