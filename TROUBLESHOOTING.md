# Troubleshooting Guide

## D3.js Visualization Not Loading

### Symptoms
- Map shows "Loading..." indefinitely
- Browser console shows "D3.js failed to load" errors
- Network tab shows failed requests to unpkg.com or d3js.org
- Console shows warnings about placeholder files

### Root Cause
External CDN libraries (D3.js and TopoJSON) may be blocked by:
- Browser security policies (CORS, mixed content)
- Corporate firewalls
- Network restrictions
- Using placeholder files instead of actual libraries

### Solution for Cloud Deployment

#### 1. Run the download script on your cloud server

During deployment or in your cloud instance, run:

```bash
cd /path/to/dataisbeautiful
./scripts/download_dependencies.sh
```

This will download the actual D3.js and TopoJSON libraries to your server's `static/js/` directory.

#### 2. Verify files exist on your server

```bash
ls -lh static/js/d3.min.js static/js/topojson.min.js
```

Expected file sizes:
- `d3.min.js` should be ~900KB
- `topojson.min.js` should be ~60KB

If files are small (< 1KB), they are placeholder files and need to be replaced.

#### 3. Restart your application

```bash
# If using uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8080

# If using Docker
docker-compose restart

# If using systemd
sudo systemctl restart your-app-service
```

#### 4. Check browser console

Open your browser's developer console (F12) and look for:

```
✓ D3.js loaded successfully (version: 7.x.x)
✓ TopoJSON loaded successfully
✓ Loaded topology from local server
```

### Manual Download (if script fails)

If the download script fails on your cloud server:

```bash
cd /path/to/dataisbeautiful

# Download D3.js
curl -L "https://unpkg.com/d3@7/dist/d3.min.js" -o "static/js/d3.min.js"

# Download TopoJSON
curl -L "https://unpkg.com/topojson@3/dist/topojson.min.js" -o "static/js/topojson.min.js"

# Download US topology data
curl -L "https://d3js.org/us-10m.v1.json" -o "data/topojson/us_states.topo.json"
```

### Integration with Docker/CI/CD

#### Dockerfile Example

Add to your Dockerfile before the CMD instruction:

```dockerfile
# Download JavaScript dependencies
RUN chmod +x scripts/download_dependencies.sh && \
    ./scripts/download_dependencies.sh
```

#### Docker Compose

```yaml
services:
  app:
    build: .
    command: sh -c "./scripts/download_dependencies.sh && uvicorn app.main:app --host 0.0.0.0 --port 8080"
```

#### GitHub Actions / CI/CD Pipeline

```yaml
- name: Download dependencies
  run: |
    chmod +x scripts/download_dependencies.sh
    ./scripts/download_dependencies.sh
```

### Verification Checklist

After deployment:

- [ ] Files exist in `static/js/` on your server
- [ ] File sizes are correct (~900KB for d3.min.js, ~60KB for topojson.min.js)
- [ ] Browser console shows no CDN errors
- [ ] Network tab shows requests to your server (not unpkg.com)
- [ ] Map visualization loads and displays correctly
- [ ] API endpoint responds: `curl http://your-server:8080/api/geo/topojson/states`

### Still Having Issues?

#### Check File Permissions

```bash
chmod 644 static/js/d3.min.js
chmod 644 static/js/topojson.min.js
```

#### Check FastAPI Static Mount

Verify in `app/main.py`:

```python
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
```

#### Test API Endpoint

```bash
curl http://localhost:8080/api/geo/topojson/states
```

Should return TopoJSON data, not a 404 error.

#### Check Browser Network Tab

1. Open Developer Tools (F12)
2. Go to Network tab
3. Reload page
4. Look for requests to `/static/js/d3.min.js` and `/static/js/topojson.min.js`
5. Status should be 200, not 404 or 403

#### Enable Debug Mode

In `static/js/map_semantic_zoom.js`, set:

```javascript
this.DEBUG = true;
```

This will log detailed information to the browser console.

## Other Common Issues

### Port Already in Use

```bash
# Find process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>
```

### CORS Errors

Check `app/main.py` CORS configuration. For production, specify your domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Replace with your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Data Not Loading

Check that `data/mobile_subscribers.csv` exists and is readable:

```bash
ls -lh data/mobile_subscribers.csv
head data/mobile_subscribers.csv
```

## Getting Help

If issues persist:

1. Check browser console for specific error messages
2. Check server logs for FastAPI errors
3. Verify all dependencies are installed: `pip install -r requirements.txt`
4. Try accessing the API directly: `curl http://localhost:8080/api/mobile/data`
