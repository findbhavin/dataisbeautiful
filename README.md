# dataisbeautiful

A collection of interactive data visualizations showcasing beautiful representations of data.

## 🚀 MapVisual Visualization Engine

**NEW:** The repository now features a full-stack FastAPI + D3.js visualization engine with Glassmorphism UI!

### Features

- **Interactive Visualization**: D3.js-powered semantic zoom map with fallback table view
- **RESTful APIs**: FastAPI backend serving mobile subscriber data
- **Modern UI**: Glassmorphism design with gradient backgrounds
- **Containerized**: Docker-ready for deployment on Google Cloud Run
- **Real-time Stats**: Dynamic statistics and metric switching

### Quick Start

#### Using Docker (Recommended)

```bash
# Build and run
docker build -t mapvisual:latest .
docker run -d -p 8080:8080 mapvisual:latest

# Access the application
open http://localhost:8080
```

#### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080

# Access the application
open http://localhost:8080
```

### API Documentation

Once running, access the interactive API documentation at:
- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc

### Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for:
- Local development
- Docker containerization
- Google Cloud Run deployment

---

## 📊 Legacy Mobile Subscriber Visualizations

Interactive maps and charts visualizing US mobile subscriber data across states and carriers.

**Note**: These are the original static HTML visualizations. The new MapVisual Engine provides a modernized, API-driven alternative.

### Quick Start (Legacy Visualizations)

1. **View Online**: Access the visualizations via GitHub Pages (if enabled) at `https://[username].github.io/dataisbeautiful/maps/`

2. **Local Development**: 
   ```bash
   # Start a local server
   python3 -m http.server 8000
   
   # Open in browser
   open http://localhost:8000/maps/
   ```

### Available Visualizations

#### 🗺️ Choropleth Map (`maps/choropleth.html`)
Interactive US state map with color-coded metrics:
- Switch between 6 different metrics (Total subscribers, Prepaid, Postpaid, Verizon, T-Mobile, AT&T)
- Hover over states for detailed information
- Color gradient legend for easy interpretation
- Excludes aggregated data from map display

#### 📊 Carrier Share Bars (`maps/carrier_share_bars.html`)
Per-state carrier market share comparison:
- Select from 32 US states
- Animated bar chart transitions
- Detailed tooltips with share percentages
- Summary statistics per state

### Data Source

All visualizations load data from `data/mobile_subscribers.csv`, which contains:
- 32 US states + aggregated "Others (Avg)" row
- Total mobile subscribers (prepaid and postpaid)
- Breakdown by major carriers: Verizon, T-Mobile, AT&T, and Others
- Values in millions of subscribers

### Technology Stack

**MapVisual Engine:**
- **Backend**: FastAPI (Python 3.9)
- **Frontend**: D3.js v7 with semantic zoom
- **Styling**: Glassmorphism CSS
- **Containerization**: Multi-stage Docker build
- **Deployment**: Google Cloud Run compatible (port 8080)

**Legacy Visualizations:**
- **D3.js v7**: Data visualization and DOM manipulation
- **TopoJSON**: US state map topology
- **Pure HTML/CSS/JS**: No build step required, fully static
- **GitHub Pages Ready**: Can be deployed directly

### Project Structure

```
.
├── app/                           # FastAPI application
│   ├── main.py                   # Application entry point
│   ├── routers/                  # API route handlers
│   └── services/                 # Business logic
├── templates/                     # Jinja2 HTML templates
├── static/                        # CSS, JavaScript assets
├── data/                         # Datasets and mappings
│   ├── mobile_subscribers.csv   # Main dataset
│   ├── mappings/                # State identifier mappings
│   └── topojson/                # Geographic data
├── maps/                         # Legacy static visualizations
│   ├── index.html
│   ├── choropleth.html
│   └── carrier_share_bars.html
├── Dockerfile                    # Container configuration
├── requirements.txt              # Python dependencies
├── DEPLOYMENT.md                 # Deployment guide
└── README.md
```

## 🌐 API Endpoints

The MapVisual Engine exposes the following REST API endpoints:

- `GET /` - Main visualization interface
- `GET /api/mobile/data` - All mobile subscriber data
- `GET /api/mobile/state/{state_iso}` - State-specific data
- `GET /api/geo/topojson/states` - US states TopoJSON
- `GET /health` - Health check endpoint

## 📦 Deployment

### Google Cloud Run

```bash
# Build and push
docker build -t gcr.io/[PROJECT-ID]/mapvisual:latest .
docker push gcr.io/[PROJECT-ID]/mapvisual:latest

# Deploy
gcloud run deploy mapvisual \
  --image gcr.io/[PROJECT-ID]/mapvisual:latest \
  --platform managed \
  --region us-central1 \
  --port 8080 \
  --allow-unauthenticated
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.
