# dataisbeautiful

A collection of interactive data visualizations showcasing beautiful representations of data.

## 📊 Mobile Subscriber Visualizations

Interactive maps and charts visualizing US mobile subscriber data across states and carriers.

### Quick Start

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

- **D3.js v7**: Data visualization and DOM manipulation
- **TopoJSON**: US state map topology
- **Pure HTML/CSS/JS**: No build step required, fully static
- **GitHub Pages Ready**: Can be deployed directly

### Project Structure

```
.
├── data/
│   └── mobile_subscribers.csv    # Dataset
├── maps/
│   ├── index.html                # Gallery landing page
│   ├── choropleth.html           # US map visualization
│   └── carrier_share_bars.html   # Carrier share chart
└── README.md
```
