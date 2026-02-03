# MapVisual Visualization Engine - Deployment Guide

## Overview

MapVisual is a FastAPI-based web application that provides interactive visualization of US mobile subscriber data. The application features a Glassmorphism UI design and serves data through RESTful APIs.

## Architecture

- **Backend**: FastAPI (Python 3.9)
- **Frontend**: D3.js (semantic zoom map) with fallback table visualization
- **Containerization**: Docker (multi-stage build)
- **Deployment Target**: Google Cloud Run (port 8080)
- **Data Source**: `data/mobile_subscribers.csv`

## Project Structure

```
.
├── app/
│   ├── main.py                      # FastAPI application entry point
│   ├── routers/
│   │   ├── mobile.py               # Mobile subscribers API endpoints
│   │   └── geo.py                  # Geographic data API endpoints
│   └── services/
│       ├── data_loader.py          # CSV data loading and processing
│       └── translation.py          # State identifier normalization
├── templates/
│   └── index.html                  # Main visualization page
├── static/
│   ├── css/
│   │   └── glassmorphism.css      # Glassmorphism UI styling
│   └── js/
│       ├── map_semantic_zoom.js   # D3.js visualization
│       └── fallback_viz.js        # Fallback table visualization
├── data/
│   ├── mobile_subscribers.csv     # Mobile subscriber dataset
│   ├── mappings/
│   │   └── state_fips_to_iso.csv # State mapping table
│   └── topojson/
│       ├── us_states.topo.json   # US states topology
│       └── us_counties.topo.json # US counties topology
├── Dockerfile                      # Multi-stage Docker build
├── requirements.txt                # Python dependencies
└── .dockerignore                   # Docker build exclusions
```

## Local Development

### Prerequisites

- Python 3.9+
- pip

### Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

3. Access the application:
- Web UI: http://localhost:8080
- API Docs: http://localhost:8080/docs
- Health Check: http://localhost:8080/health

## API Endpoints

### Mobile Subscribers

- `GET /api/mobile/data` - Get all mobile subscriber data by state
- `GET /api/mobile/state/{state_iso}` - Get data for specific state (e.g., `/api/mobile/state/CA`)

### Geographic Data

- `GET /api/geo/topojson/states` - Get US states TopoJSON
- `GET /api/geo/topojson/counties` - Get US counties TopoJSON
- `GET /api/geo/geojson/states` - Get US states GeoJSON (converted)

### System

- `GET /health` - Health check endpoint

## Docker Deployment

### Build Image

```bash
docker build -t mapvisual:latest .
```

### Run Container Locally

```bash
docker run -d -p 8080:8080 --name mapvisual mapvisual:latest
```

### Test Container

```bash
# Health check
curl http://localhost:8080/health

# API test
curl http://localhost:8080/api/mobile/data

# Open in browser
open http://localhost:8080
```

### Stop and Remove Container

```bash
docker stop mapvisual
docker rm mapvisual
```

## Google Cloud Run Deployment

### Prerequisites

- Google Cloud SDK installed and authenticated
- Project created in Google Cloud Console

### Deploy to Cloud Run

1. Build and tag image for Google Container Registry:
```bash
export PROJECT_ID=your-gcp-project-id
export REGION=us-central1

docker build -t gcr.io/${PROJECT_ID}/mapvisual:latest .
docker push gcr.io/${PROJECT_ID}/mapvisual:latest
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy mapvisual \
  --image gcr.io/${PROJECT_ID}/mapvisual:latest \
  --platform managed \
  --region ${REGION} \
  --port 8080 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1
```

3. Get the service URL:
```bash
gcloud run services describe mapvisual \
  --region ${REGION} \
  --format 'value(status.url)'
```

### Deploy Using Cloud Build (Alternative)

1. Create `cloudbuild.yaml`:
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/mapvisual:$SHORT_SHA', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/mapvisual:$SHORT_SHA']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'mapvisual'
      - '--image=gcr.io/$PROJECT_ID/mapvisual:$SHORT_SHA'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
images:
  - 'gcr.io/$PROJECT_ID/mapvisual:$SHORT_SHA'
```

2. Deploy:
```bash
gcloud builds submit --config cloudbuild.yaml
```

## Environment Variables

The application uses the following environment variables (all optional):

- `PORT` - Server port (default: 8080)
- `PYTHONUNBUFFERED` - Python logging (default: 1)

## Data Format

The application expects `data/mobile_subscribers.csv` with the following columns:

- Rank
- State
- Total_Mobile_T (Total mobile subscribers in millions)
- Total_Pre (Prepaid subscribers)
- Total_Post (Postpaid subscribers)
- Verizon_T, Verizon_Pre, Verizon_Post
- TMobile_T, TMobile_Pre, TMobile_Post
- ATT_T, ATT_Pre, ATT_Post
- Others_T, Others_Pre, Others_Post

## Features

### Backend Features

- **FastAPI Framework**: High-performance async API server
- **Automatic API Documentation**: Swagger UI at `/docs`
- **Data Normalization**: Converts state identifiers (FIPS, full names, abbreviations) to ISO-2 codes
- **Aggregate Handling**: Special handling for "Others" and aggregate rows with 'OTH' designation
- **Health Checks**: Container orchestration-ready health endpoint

### Frontend Features

- **Glassmorphism UI**: Modern frosted glass design aesthetic
- **Semantic Zoom**: D3.js-powered interactive map with zoom capabilities
- **Fallback Visualization**: Table-based view when D3.js libraries are unavailable
- **Responsive Design**: Mobile-friendly layout
- **Multiple Metrics**: Switch between different subscriber metrics
- **Interactive Stats**: Real-time statistics display

## Performance

- **Multi-stage Docker Build**: Optimized image size (~200MB)
- **Python 3.9 Slim**: Minimal base image
- **Async API**: Non-blocking request handling
- **Static File Serving**: Efficient delivery of assets

## Security

- **No Hardcoded Secrets**: No credentials in code
- **Health Check**: Monitors service availability
- **Read-only Data**: CSV files are read-only
- **CORS**: Can be configured for specific origins

## Troubleshooting

### Application won't start

Check logs:
```bash
docker logs mapvisual
```

### API returns 500 errors

Verify data files exist:
```bash
ls -la data/mobile_subscribers.csv
ls -la data/mappings/state_fips_to_iso.csv
```

### Visualization doesn't load

1. Check browser console for JavaScript errors
2. Verify API endpoints are accessible: `/api/mobile/data`
3. Fallback visualization should automatically load if D3.js is unavailable

### Docker build fails

1. Ensure requirements.txt is valid
2. Check network connectivity for package downloads
3. Verify Dockerfile syntax

## Monitoring

Key metrics to monitor in production:

- **Response Times**: `/health` endpoint should respond < 100ms
- **Memory Usage**: Application typically uses < 256MB
- **Error Rates**: Monitor 500 errors
- **Request Volume**: Track API call patterns

## License

Copyright (c) 2026. All rights reserved.

## Support

For issues and questions, please open a GitHub issue in the repository.
