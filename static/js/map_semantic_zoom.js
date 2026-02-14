/**
 * MapVisual Semantic Zoom Map
 * Interactive D3.js visualization with semantic zoom capabilities
 * 
 * Data Source:
 * - TopoJSON: https://d3js.org/us-10m.v1.json (uses numeric FIPS codes for state IDs)
 * - Subscriber data: /api/mobile/data (uses ISO-2 state codes)
 * 
 * State Matching:
 * - TopoJSON features have numeric FIPS codes (e.g., "06" for California)
 * - Our data uses ISO-2 codes (e.g., "CA" for California)
 * - We use a FIPS-to-ISO lookup table to match them
 */

class MapVisualizer {
    constructor(containerId, country = 'us') {
        this.containerId = containerId;
        this.country = country || 'us';
        this.data = null;
        this.currentMetric = 'total_subscribers';
        this.mapMode = 'subscribers';  // 'subscribers' | 'data-centers' | 'dc-tiers' | 'hub-pairs'
        this.colorScale = null;
        this.statesFeatures = null;  // Store for re-styling in different modes
        this.projection = null;
        this.path = null;
        this.svg = null;
        this.g = null;
        this.zoom = null;
        this.tooltip = null;
        this.resizeTimeout = null;  // For debouncing window resize events
        this.resizeHandler = null;  // Store resize handler reference for potential cleanup
        
        // Debug mode - set to false in production
        this.DEBUG = true;  // Set to false to disable console logging
        
        this.width = 960;
        this.height = 600;
        
        // Constants for label rendering
        this.BASE_LABEL_FONT_SIZE = 10;  // Base font size for metric value
        this.STATE_NAME_FONT_SIZE = 7;   // Small font for state name
        this.OTHERS_AVG_STATE_ISO = 'OTH';  // ISO code for "Others (Avg)" to exclude from map
        
        // Constants for state styling
        // Using #1f2937 (dark gray) instead of #ffffff (white) for clear contrast against glass background
        // CSS also uses dark gray (#333333) to ensure visibility regardless of style precedence
        this.STATE_STROKE_COLOR = '#1f2937';  // Dark gray borders for visibility
        this.STATE_STROKE_WIDTH = 1;  // Balanced stroke width (CSS fallback is 0.5px)
        this.DC_MODE_STROKE_WIDTH = 2;  // Stronger borders for Data Centers / Hub Pairs
        this.DC_MODE_STROKE_COLOR = '#0f172a';  // Darker stroke for DC modes
        this.STATE_FILL_OPACITY = 0.9;  // Slightly higher opacity for better color saturation
        
        // ColorBrewer YlGnBu sequential (colorblind-friendly); lighter palette for light theme
        // Lighter = less dense, darker = more dense
        this.colorScheme = ['#f7fcf0', '#ccebc5', '#7bccc4', '#43a2ca', '#0868ac', '#084081'];
        this.debugLog('[MapVisualizer] Color scheme initialized with', this.colorScheme.length, 'colors:', this.colorScheme);
        
        // FIPS to ISO-2 state code mapping
        // Source: https://www.census.gov/library/reference/code-lists/ansi.html
        this.fipsToIso = {
            '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
            '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
            '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
            '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
            '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
            '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
            '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
            '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
            '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
            '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
            '56': 'WY', '72': 'PR'
        };
        this.isoToStateName = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
            'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'DC': 'Washington DC', 'FL': 'Florida',
            'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana',
            'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine',
            'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
            'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire',
            'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota',
            'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island',
            'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
            'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin',
            'WY': 'Wyoming', 'PR': 'Puerto Rico'
        };
    }
    
    /**
     * Debug logging helper - only logs when DEBUG flag is enabled
     */
    debugLog(...args) {
        if (this.DEBUG) {
            console.log(...args);
        }
    }
    
    async initialize() {
        // Load mobile subscriber data
        await this.loadData();
        
        // Setup SVG and projection
        this.setupSVG();
        
        // Setup tooltip
        this.setupTooltip();
        
        // Load and render map
        await this.renderMap();
        
        // Update stats display
        this.updateStats();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    async loadData() {
        try {
            const url = (this.country === 'india' || this.country === 'india-option-b') ? '/api/mobile/india/data' : '/api/mobile/data';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.data = await response.json();
            this.debugLog('Data loaded:', this.data);
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }
    
    setupSVG() {
        this.debugLog('[MapVisualizer] Setting up SVG canvas');
        const container = d3.select(`#${this.containerId}`);
        container.selectAll('*').remove();
        
        this.svg = container
            .append('svg')
            .attr('id', 'map')
            .attr('width', '100%')
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        
        this.debugLog(`[MapVisualizer] SVG dimensions: ${this.width}x${this.height}`);
        
        // Create container group for zoom
        this.g = this.svg.append('g');
        
        // Setup projection: US uses AlbersUsa, India uses Mercator
        // Bounds [68,6]-[97,38] include POK (west) and Aksai Chin (east) for full India-claimed territory
        if (this.country === 'india' || this.country === 'india-option-b') {
            this.projection = d3.geoMercator()
                .center([77.5, 22])
                .translate([this.width / 2, this.height / 2])
                .scale(600);
            this.debugLog('[MapVisualizer] Projection configured: Mercator (India), bounds [68,6]-[97,38], scale=600');
        } else {
            this.projection = d3.geoAlbersUsa()
                .translate([this.width / 2, this.height / 2])
                .scale(1200);
            this.debugLog('[MapVisualizer] Projection configured: AlbersUsa, scale=1200');
        }
        
        this.path = d3.geoPath().projection(this.projection);
        
        // Setup zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
                
                // Scale labels inversely to zoom to keep them readable
                // Also update visibility based on zoom level
                const scale = event.transform.k;
                this.g.selectAll('.state-label')
                    .style('font-size', `${this.BASE_LABEL_FONT_SIZE / Math.sqrt(scale)}px`)
                    .style('opacity', scale < 2 ? 1 : 0.8);
            });
        
        this.svg.call(this.zoom);
        
        // CRITICAL FIX: Explicitly set initial zoom transform to identity
        // This ensures the map always starts at the default zoom/pan position
        this.svg.call(this.zoom.transform, d3.zoomIdentity);
        
        this.debugLog('[MapVisualizer] Initial zoom transform set to identity');
    }
    
    setupTooltip() {
        // Remove existing tooltip if any
        d3.select('.tooltip').remove();
        
        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0)
            .style('position', 'absolute');
    }
    
    /**
     * Load topology/geography. US uses TopoJSON. India uses GeoJSON (TopoJSON has invalid arc indices).
     */
    async loadTopology() {
        if (this.country === 'india-option-b') {
            try {
                const geoRes = await fetch('/api/geo/india/option-b/geojson');
                if (geoRes.ok) {
                    const geojson = await geoRes.json();
                    if (geojson?.features?.length) {
                        console.log('✓ Loaded India Option B (udit-001):', geojson.features.length, 'states');
                        return { type: 'geojson', data: geojson };
                    }
                }
                throw new Error('India Option B map unavailable');
            } catch (e) {
                console.error('India Option B map failed:', e);
                throw e;
            }
        }
        if (this.country === 'india') {
            try {
                const geoRes = await fetch('/api/geo/india/geojson/states');
                if (geoRes.ok) {
                    const geojson = await geoRes.json();
                    if (geojson?.features?.length) {
                        console.log('✓ Loaded India GeoJSON (legacy):', geojson.features.length, 'states');
                        return { type: 'geojson', data: geojson };
                    }
                }
                const indiaTopoJson = await d3.json('/api/geo/topojson/india-states');
                if (!indiaTopoJson?.objects?.states?.geometries?.length) throw new Error('India TopoJSON invalid');
                try {
                    const states = topojson.feature(indiaTopoJson, indiaTopoJson.objects.states);
                    if (states?.features?.length) {
                        console.log('✓ Loaded India TopoJSON:', states.features.length, 'states');
                        return { type: 'geojson', data: states };
                    }
                } catch (te) {
                    console.warn('India TopoJSON conversion failed, GeoJSON not available:', te.message);
                }
                throw new Error('Unable to load India map. Run: py scripts/download_india_geojson.py');
            } catch (e) {
                console.error('India map failed:', e);
                throw e;
            }
        }
        const localPath = '/api/geo/topojson/states';
        const cdnPath = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
        try {
            const us = await d3.json(localPath);
            console.log('✓ Loaded US topology from local server');
            return { type: 'topojson', data: us };
        } catch (localError) {
            console.warn('Local topology failed:', localError.message);
            try {
                const us = await d3.json(cdnPath);
                console.log('✓ Loaded US topology from CDN');
                return { type: 'topojson', data: us };
            } catch (cdnError) {
                throw new Error('Unable to load map data. Local: ' + localError.message + ', CDN: ' + cdnError.message);
            }
        }
    }

    async renderMap() {
        try {
            const topo = await this.loadTopology();
            let states;
            if (topo.type === 'geojson') {
                states = topo.data;
                if (!states?.features?.length) {
                    this.showError('Map data is empty. Please refresh the page.');
                    return;
                }
            } else {
                const topoData = topo.data;
                if (!topoData?.objects?.states) {
                    this.showError('Map data is unavailable. Please refresh the page.');
                    return;
                }
                if (!topoData.arcs?.length) {
                    this.showError('Map topology data is incomplete.');
                    return;
                }
                states = topojson.feature(topoData, topoData.objects.states);
            }
            
            this.debugLog(`Loaded ${states.features.length} state features from TopoJSON`);
            
            // Validate features
            if (!states.features || states.features.length === 0) {
                console.error('No state features found in TopoJSON');
                this.showError('Map data is empty. Please refresh the page.');
                return;
            }
            
            // Setup color scale based on current metric
            this.updateColorScale();
            
            // Store features for mode-based re-styling
            this.statesFeatures = states.features;
            
            // Draw states with proper data matching
            this.debugLog(`[MapVisualizer] Drawing states with styling: stroke=${this.STATE_STROKE_COLOR}, stroke-width=${this.STATE_STROKE_WIDTH}, fill-opacity=${this.STATE_FILL_OPACITY}`);
            const isDcMode = ['data-centers', 'dc-tiers', 'hub-pairs'].includes(this.mapMode);
            const strokeW = isDcMode ? this.DC_MODE_STROKE_WIDTH : this.STATE_STROKE_WIDTH;
            const strokeC = isDcMode ? this.DC_MODE_STROKE_COLOR : this.STATE_STROKE_COLOR;
            const statePaths = this.g.selectAll('.state')
                .data(states.features)
                .join('path')
                .attr('class', 'state')
                .attr('d', this.path)
                .attr('fill', d => this.getStateFill(d))
                .attr('stroke', strokeC)
                .attr('stroke-width', strokeW)
                .style('fill-opacity', this.STATE_FILL_OPACITY)
                .on('mouseover', (event, d) => this.handleMouseOver(event, d))
                .on('mousemove', (event, d) => this.handleMouseMove(event, d))
                .on('mouseout', (event, d) => this.handleMouseOut(event, d))
                .on('click', (event, d) => this.handleClick(event, d));
            
            this.debugLog('[MapVisualizer] Total state paths created:', statePaths.size());
            
            // Log matching statistics for debugging
            const matchedStates = states.features.filter(f => this.getStateDataForFeature(f) !== null).length;
            this.debugLog(`Matched ${matchedStates} out of ${states.features.length} states to data`);
            
            // Render state labels using lat/long coordinates
            this.renderStateLabels();
            
            // Render hub pairs if in that mode
            if (this.mapMode === 'hub-pairs') this.renderHubPairsDots();
            
            // Update legend
            this.updateLegend();
            
        } catch (error) {
            console.error('Error rendering map:', error);
            
            // Sanitize error message by converting to string and escaping HTML
            const sanitizedMessage = String(error.message || 'Unknown error')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            
            // Show user-friendly error with retry option
            const errorContainer = d3.select("#map-svg-container");
            errorContainer.html('');
            
            const errorDiv = errorContainer.append('div')
                .attr('class', 'error-message')
                .style('padding', '40px')
                .style('text-align', 'center')
                .style('color', '#fff');
            
            errorDiv.append('h3')
                .style('color', '#ff6b6b')
                .text('⚠️ Map Unavailable');
            
            errorDiv.append('p')
                .text('Unable to load map visualization data.');
            
            errorDiv.append('p')
                .style('font-size', '14px')
                .style('opacity', '0.8')
                .text(sanitizedMessage);
            
            errorDiv.append('button')
                .style('margin-top', '20px')
                .style('padding', '10px 20px')
                .style('cursor', 'pointer')
                .style('background-color', '#4CAF50')
                .style('color', 'white')
                .style('border', 'none')
                .style('border-radius', '4px')
                .text('Retry')
                .on('click', () => location.reload());
        }
    }
    
    createFallbackMapData() {
        // Minimal fallback structure if external data fails
        return {
            type: 'Topology',
            objects: {
                states: {
                    type: 'GeometryCollection',
                    geometries: []
                }
            },
            arcs: []
        };
    }
    
    getStateDataForFeature(feature) {
        if (this.country === 'india' || this.country === 'india-option-b') {
            // Try matching by state_iso (from TopoJSON id)
            const stateIso = feature.id || feature.properties?.state_iso;
            if (stateIso) {
                const matchByIso = this.data.by_state.find(d =>
                    d.state_iso && d.state_iso.toUpperCase() === String(stateIso).toUpperCase()
                );
                if (matchByIso) return matchByIso;
            }
            
            // Try matching by name (normalize " & " to " and "; also support st_nm from udit-001)
            const name = (feature.properties?.name || feature.properties?.NAME_1 || feature.properties?.st_nm || '').replace(/\s*&\s*/g, ' and ').trim();
            if (!name) return null;
            const norm = (s) => (s || '').replace(/\s*&\s*/g, ' and ').toLowerCase().trim();
            return this.data.by_state.find(d =>
                d.state_name && norm(d.state_name) === norm(name)
            ) || null;
        }
        let fipsCode = null;
        if (feature.id !== undefined && feature.id !== null) {
            fipsCode = String(feature.id).padStart(2, '0');
        }
        if (fipsCode && this.fipsToIso[fipsCode]) {
            const isoCode = this.fipsToIso[fipsCode];
            const stateData = this.data.by_state.find(d =>
                d.state_iso === isoCode && d.state_iso !== this.OTHERS_AVG_STATE_ISO
            );
            if (stateData) return stateData;
        }
        if (feature.properties && feature.properties.name) {
            const featureName = feature.properties.name;
            const stateData = this.data.by_state.find(d => {
                if (!d.state_name || d.state_iso === 'OTH') return false;
                return d.state_name.toLowerCase() === featureName.toLowerCase();
            });
            if (stateData) return stateData;
        }
        return null;
    }
    
    /**
     * Get fill color for a state feature based on current map mode.
     */
    getStateFill(d) {
        if (this.mapMode === 'data-centers') {
            return '#e2e8f0';
        }
        if (this.mapMode === 'dc-tiers') {
            return '#e2e8f0';
        }
        if (this.mapMode === 'hub-pairs') {
            return '#e2e8f0';
        }
        const stateData = this.getStateDataForFeature(d);
        if (!stateData) return '#e2e8f0';
        const val = stateData[this.currentMetric];
        const isRevenue = this.currentMetric === 'revenue_inr_cr' || this.currentMetric === 'annual_revenue_b';
        if (isRevenue && (val == null || val === 0 || isNaN(val))) return '#e2e8f0';
        return this.colorScale(val);
    }
    
    renderStateLabels() {
        /**
         * Render text labels on each state.
         * Subscribers: state name + metric value.
         * DC Tiers / Hub Pairs: state name only (using centroid).
         */
        
        this.g.selectAll('.state-label').remove();
        
        if (this.mapMode === 'dc-tiers' || this.mapMode === 'hub-pairs' || this.mapMode === 'data-centers') {
            this.renderStateNameLabels();
            return;
        }
        if (this.mapMode !== 'subscribers') return;
        
        const stateData = this.data.by_state.filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO);
        
        // Add labels for each state: state name (small) + subscriber value
        const mapviz = this;
        const labels = this.g.selectAll('.state-label')
            .data(stateData)
            .join('text')
            .attr('class', 'state-label')
            .attr('x', d => {
                const lng = d?.longitude;
                const lat = d?.latitude;
                if (lng == null || lat == null) return 0;
                const coords = this.projection([lng, lat]);
                return coords ? coords[0] : 0;
            })
            .attr('y', d => {
                const lng = d?.longitude;
                const lat = d?.latitude;
                if (lng == null || lat == null) return 0;
                const coords = this.projection([lng, lat]);
                return coords ? coords[1] : 0;
            })
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', `${this.BASE_LABEL_FONT_SIZE}px`)
            .style('font-weight', 'bold')
            .style('fill', '#1a1a1a')
            .style('stroke', '#ffffff')
            .style('stroke-width', '0.5px')
            .style('paint-order', 'stroke')
            .style('pointer-events', 'none')
            .each(function(d) {
                const value = d[mapviz.currentMetric];
                const stateName = d.state_name || d.state_iso || '';
                const valueStr = mapviz.formatValue(value);
                const tspan = d3.select(this);
                tspan.append('tspan').attr('x', tspan.attr('x')).attr('dy', '-0.4em')
                    .style('font-size', '0.7em').style('font-weight', 'normal')
                    .text(stateName);
                tspan.append('tspan').attr('x', tspan.attr('x')).attr('dy', '1.1em')
                    .text(valueStr);
            });
        
        // Store reference to labels for zoom updates
        this.labels = labels;
    }
    
    renderStateNameLabels() {
        if (!this.statesFeatures) return;
        const mapviz = this;
        this.g.selectAll('.state-label')
            .data(this.statesFeatures)
            .join('text')
            .attr('class', 'state-label')
            .attr('x', d => {
                try {
                    if (!d?.geometry) return 0;
                    const c = d3.geoCentroid(d);
                    const p = this.projection(c);
                    return p ? p[0] : 0;
                } catch (e) { return 0; }
            })
            .attr('y', d => {
                try {
                    if (!d?.geometry) return 0;
                    const c = d3.geoCentroid(d);
                    const p = this.projection(c);
                    return p ? p[1] : 0;
                } catch (e) { return 0; }
            })
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', `${this.STATE_NAME_FONT_SIZE}px`)
            .style('font-weight', 'normal')
            .style('fill', '#1a1a1a')
            .style('stroke', '#ffffff')
            .style('stroke-width', '0.5px')
            .style('paint-order', 'stroke')
            .style('pointer-events', 'none')
            .text(d => {
                if (this.country === 'india' || this.country === 'india-option-b') {
                    return d.properties?.NAME_1 || d.properties?.name || d.properties?.st_nm || '';
                }
                const fips = d.id != null ? String(d.id).padStart(2, '0') : null;
                const iso = fips && this.fipsToIso[fips] ? this.fipsToIso[fips] : null;
                return iso ? (this.isoToStateName[iso] || iso) : '';
            });
    }
    
    updateStateLabels() {
        if (!this.labels || this.labels.empty()) return;
        this.labels.selectAll('tspan:last-child')
            .transition().duration(500)
            .text(d => this.formatValue(d[this.currentMetric]));
    }
    
    getStateDataById(stateId) {
        // DEPRECATED: Use getStateDataForFeature instead
        // This method is kept for backward compatibility but delegates to the new method
        return this.getStateDataForFeature({ id: stateId });
    }
    
    updateColorScale() {
        const isRev = this.currentMetric === 'revenue_inr_cr' || this.currentMetric === 'annual_revenue_b';
        const values = this.data.by_state
            .filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO)
            .map(d => d[this.currentMetric])
            .filter(v => v != null && !isNaN(v) && (!isRev || v > 0));
        
        const extent = d3.extent(values);
        
        this.debugLog(`[MapVisualizer] Updating color scale for metric '${this.currentMetric}'`);
        this.debugLog('[MapVisualizer] Value extent:', extent, 'min:', extent[0], 'max:', extent[1]);
        this.debugLog('[MapVisualizer] Number of data points:', values.length);
        
        const isRevenue = this.currentMetric === 'revenue_inr_cr' || this.currentMetric === 'annual_revenue_b';
        const revenueScheme = ['#b91c1c', '#f87171', '#fef08a', '#86efac', '#15803d'];
        const scheme = isRevenue ? revenueScheme : this.colorScheme;
        
        this.colorScale = d3.scaleQuantize()
            .domain(extent)
            .range(scheme);
        
        this.debugLog('[MapVisualizer] Color scale domain:', this.colorScale.domain());
        this.debugLog('[MapVisualizer] Color scale range:', this.colorScale.range());
    }
    
    updateLegend() {
        const legendContainer = d3.select('#legend-scale');
        const minLabel = d3.select('#legend-min');
        const maxLabel = d3.select('#legend-max');
        if (legendContainer.empty()) return;
        
        legendContainer.selectAll('*').remove();
        
        if (this.mapMode === 'data-centers') {
            legendContainer.append('div').style('background-color', '#084081').style('flex', '1').style('height', '100%').style('min-width', '60px').attr('title', 'Super Core');
            legendContainer.append('div').style('background-color', '#0868ac').style('flex', '1').style('height', '100%').style('min-width', '60px').attr('title', 'Other DC');
            legendContainer.style('display', 'flex');
            if (!minLabel.empty()) minLabel.text('Super Core');
            if (!maxLabel.empty()) maxLabel.text('Other');
            return;
        }
        if (this.mapMode === 'dc-tiers') {
            legendContainer.append('div').style('background-color', '#084081').style('flex', '1').style('height', '100%').style('min-width', '50px').attr('title', 'Tier 1 - Super Core (circle)');
            legendContainer.append('div').style('background-color', '#0d9488').style('flex', '1').style('height', '100%').style('min-width', '50px').attr('title', 'Tier 2 - Regional (square)');
            legendContainer.append('div').style('background-color', '#ea580c').style('flex', '1').style('height', '100%').style('min-width', '50px').attr('title', 'Tier 3 - Edge (triangle)');
            legendContainer.style('display', 'flex');
            if (!minLabel.empty()) minLabel.text('Tier 1');
            if (!maxLabel.empty()) maxLabel.text('Tier 3');
            return;
        }
        if (this.mapMode === 'hub-pairs') {
            legendContainer.append('div').style('background-color', '#0284c7').style('flex', '1').style('height', '100%').style('min-width', '50px').attr('title', 'Dual (Regional & Edge)');
            legendContainer.append('div').style('background-color', '#16a34a').style('flex', '1').style('height', '100%').style('min-width', '50px').attr('title', 'Single Edge');
            legendContainer.append('div').style('background-color', '#dc2626').style('flex', '1').style('height', '100%').style('min-width', '50px').attr('title', 'Super Core');
            legendContainer.style('display', 'flex');
            if (!minLabel.empty()) minLabel.text('Dual');
            if (!maxLabel.empty()) maxLabel.text('Super');
            return;
        }
        
        const isRevenue = this.currentMetric === 'revenue_inr_cr' || this.currentMetric === 'annual_revenue_b';
        const legendScheme = isRevenue ? ['#b91c1c', '#f87171', '#fef08a', '#86efac', '#15803d'] : this.colorScheme;
        const legendWidth = legendContainer.node().clientWidth;
        const segmentWidth = legendWidth / legendScheme.length;
        
        legendScheme.forEach((color) => {
            legendContainer.append('div')
                .style('background-color', color)
                .style('width', `${segmentWidth}px`)
                .style('height', '100%')
                .style('display', 'inline-block');
        });
        
        const isRev = this.currentMetric === 'revenue_inr_cr' || this.currentMetric === 'annual_revenue_b';
        const values = this.data.by_state
            .filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO)
            .map(d => d[this.currentMetric])
            .filter(v => v != null && !isNaN(v) && (!isRev || v > 0));
        const extent = d3.extent(values);
        if (!minLabel.empty() && !maxLabel.empty()) {
            minLabel.text(this.formatValue(extent[0]));
            maxLabel.text(this.formatValue(extent[1]));
        }
    }
    
    clearHubPairsDots() {
        this.g.selectAll('.hub-dots-layer').remove();
    }
    
    clearStateCentroidDots() {
        this.g.selectAll('.state-centroid-dots').remove();
    }
    
    renderStateCentroidDots() {
        this.clearStateCentroidDots();
        if (!this.statesFeatures) return;
        const layer = this.g.append('g').attr('class', 'state-centroid-dots');
        const tierColors = { tier1: '#084081', tier2: '#0d9488', tier3: '#ea580c' };
        const shapeSize = 6;
        const offsetStep = 10;
        const fillOpacity = 0.6;
        this.statesFeatures.forEach(d => {
            if (this.mapMode === 'data-centers') {
                const stateValues = window.__dataCentersStateValues || {};
                const key = (this.country === 'india' || this.country === 'india-option-b') ? (d.properties?.NAME_1 || d.properties?.name || d.properties?.st_nm || '') : (() => {
                    const fipsCode = d.id != null ? String(d.id).padStart(2, '0') : null;
                    return fipsCode && this.fipsToIso[fipsCode] ? this.fipsToIso[fipsCode] : null;
                })();
                const value = key ? (stateValues[key] || '').trim() : '';
                if (!value || value === 'None') return;
                let centroid;
                try { centroid = d?.geometry ? d3.geoCentroid(d) : null; } catch (e) { return; }
                if (!centroid) return;
                const projected = this.projection(centroid);
                if (!projected) return;
                const color = /super\s*core/i.test(value) ? '#084081' : '#0868ac';
                layer.append('circle').attr('cx', projected[0]).attr('cy', projected[1]).attr('r', shapeSize)
                    .attr('fill', color).attr('fill-opacity', 0.6).attr('stroke', this.DC_MODE_STROKE_COLOR).attr('stroke-width', 2).style('pointer-events', 'none');
                return;
            }
            const activeTiers = this.getActiveTiersForState(d);
            if (activeTiers.length === 0) return;
            let centroid;
            try { centroid = d?.geometry ? d3.geoCentroid(d) : null; } catch (e) { return; }
            if (!centroid) return;
            const projected = this.projection(centroid);
            if (!projected) return;
            const [cx, cy] = projected;
            const totalWidth = (activeTiers.length - 1) * offsetStep;
            const startX = cx - totalWidth / 2;
            activeTiers.forEach((tier, i) => {
                const x = activeTiers.length === 1 ? cx : startX + i * offsetStep;
                const color = tierColors[tier] || '#ea580c';
                if (tier === 'tier1') {
                    layer.append('circle').attr('cx', x).attr('cy', cy).attr('r', shapeSize)
                        .attr('fill', color).attr('fill-opacity', fillOpacity).attr('stroke', this.DC_MODE_STROKE_COLOR).attr('stroke-width', 2).style('pointer-events', 'none');
                } else if (tier === 'tier2') {
                    const s = shapeSize * 1.2;
                    layer.append('rect').attr('x', x - s).attr('y', cy - s).attr('width', s * 2).attr('height', s * 2)
                        .attr('fill', color).attr('fill-opacity', fillOpacity).attr('stroke', this.DC_MODE_STROKE_COLOR).attr('stroke-width', 2).style('pointer-events', 'none');
                } else {
                    const r = shapeSize * 1.3;
                    const path = `M ${x} ${cy - r} L ${x + r} ${cy + r} L ${x - r} ${cy + r} Z`;
                    layer.append('path').attr('d', path)
                        .attr('fill', color).attr('fill-opacity', fillOpacity).attr('stroke', this.DC_MODE_STROKE_COLOR).attr('stroke-width', 2).style('pointer-events', 'none');
                }
            });
        });
    }
    
    getActiveTiersForState(d) {
        const tiers = window.__dataCenterTiers || { tier1: new Set(), tier2: new Set(), tier3: new Set() };
        const visible = window.__dataCenterTiersVisible || { tier1: true, tier2: true, tier3: true };
        let key;
        if (this.country === 'india' || this.country === 'india-option-b') {
            key = d.properties?.NAME_1 || d.properties?.name || d.properties?.st_nm || '';
        } else {
            const fipsCode = d.id != null ? String(d.id).padStart(2, '0') : null;
            key = fipsCode && this.fipsToIso[fipsCode] ? this.fipsToIso[fipsCode] : null;
        }
        if (!key) return [];
        const active = [];
        if (visible.tier1 && tiers.tier1?.has(key)) active.push('tier1');
        if (visible.tier2 && tiers.tier2?.has(key)) active.push('tier2');
        if (visible.tier3 && tiers.tier3?.has(key)) active.push('tier3');
        return active;
    }
    
    stateHasDcData(d) {
        let key;
        if (this.country === 'india' || this.country === 'india-option-b') {
            key = d.properties?.NAME_1 || d.properties?.name || d.properties?.st_nm || '';
        } else {
            const fipsCode = d.id != null ? String(d.id).padStart(2, '0') : null;
            key = fipsCode && this.fipsToIso[fipsCode] ? this.fipsToIso[fipsCode] : null;
        }
        if (!key) return false;
        if (this.mapMode === 'data-centers') {
            const stateValues = window.__dataCentersStateValues || {};
            const value = (stateValues[key] || '').trim();
            return !!value && value !== 'None';
        }
        if (this.mapMode === 'dc-tiers') {
            const tiers = window.__dataCenterTiers || { tier1: new Set(), tier2: new Set(), tier3: new Set() };
            const visible = window.__dataCenterTiersVisible || { tier1: true, tier2: true, tier3: true };
            return (visible.tier1 && tiers.tier1?.has(key)) || (visible.tier2 && tiers.tier2?.has(key)) || (visible.tier3 && tiers.tier3?.has(key));
        }
        return false;
    }
    
    renderHubPairsDots() {
        this.clearHubPairsDots();
        const byType = window.__hubPairsByType;
        const custom = window.__hubPairs || [];
        const layer = this.g.append('g').attr('class', 'hub-dots-layer');
        const drawPair = (p, isCustom) => {
            const c1 = p.c1;
            const c2 = p.c2 || (isCustom ? null : null);
            if (!c1 || !Array.isArray(c1)) return;
            const toLngLat = (c) => Array.isArray(c) ? c : (c && (c.lng != null || c.lngitude != null) ? [c.lng ?? c.longitude, c.lat ?? c.latitude] : null);
            const coord1 = toLngLat(c1);
            const coord2 = c2 ? toLngLat(c2) : null;
            if (!coord1) return;
            const p1 = this.projection(coord1);
            const p2 = coord2 ? this.projection(coord2) : null;
            const color = p.color || '#0284c7';
            if (p1 && p2) {
                layer.append('line')
                    .attr('x1', p1[0]).attr('y1', p1[1]).attr('x2', p2[0]).attr('y2', p2[1])
                    .attr('stroke', color).attr('stroke-width', 2.5).attr('stroke-opacity', 0.8);
            }
            [p1, p2].filter(Boolean).forEach(proj => {
                layer.append('circle')
                    .attr('cx', proj[0]).attr('cy', proj[1]).attr('r', 7)
                    .attr('fill', color).attr('stroke', this.DC_MODE_STROKE_COLOR).attr('stroke-width', 2)
                    .style('pointer-events', 'none');
            });
        };
        const visible = window.__hubPairsVisible || { dual: true, single: true, superCore: true };
        if (custom.length > 0) {
            custom.forEach(p => drawPair(p, true));
        } else if (byType && (byType.dual?.length || byType.single?.length || byType.superCore?.length)) {
            ['dual', 'superCore', 'single'].forEach(t => {
                if (!visible[t]) return;
                (byType[t] || []).forEach(p => drawPair(p, false));
            });
        }
    }
    
    handleMouseOver(event, d) {
        d3.select(event.currentTarget).style('opacity', 0.8);
        
        if (this.mapMode === 'data-centers') {
            const stateValues = window.__dataCentersStateValues || {};
            const fipsCode = d.id != null ? String(d.id).padStart(2, '0') : null;
            const iso = fipsCode && this.fipsToIso[fipsCode] ? this.fipsToIso[fipsCode] : null;
            const stateName = (this.data?.by_state?.find(s => s.state_iso === iso)?.state_name) || (d.properties?.name) || iso || 'Unknown';
            const value = iso ? (stateValues[iso] || '').trim() : '';
            const typeStr = value && value !== 'None' ? value : 'No data center';
            this.tooltip.style('opacity', 1).html(`<div class="tooltip-title">${stateName}</div><div class="tooltip-content">${typeStr}</div>`);
            return;
        }
        if (this.mapMode === 'dc-tiers') {
            const fipsCode = d.id != null ? String(d.id).padStart(2, '0') : null;
            const iso = fipsCode && this.fipsToIso[fipsCode] ? this.fipsToIso[fipsCode] : null;
            const stateName = (this.data?.by_state?.find(s => s.state_iso === iso)?.state_name) || (d.properties?.name) || iso || 'Unknown';
            const tiers = window.__dataCenterTiers || { tier1: new Set(), tier2: new Set(), tier3: new Set() };
            const labels = [];
            if (tiers.tier1?.has(iso)) labels.push('Tier 1 - Super Core');
            if (tiers.tier2?.has(iso)) labels.push('Tier 2 - Regional');
            if (tiers.tier3?.has(iso)) labels.push('Tier 3 - Edge');
            const tierStr = labels.length ? labels.join(', ') : 'No data center';
            this.tooltip.style('opacity', 1).html(`<div class="tooltip-title">${stateName}</div><div class="tooltip-content">${tierStr}</div>`);
            return;
        }
        if (this.mapMode === 'hub-pairs') {
            const fipsCode = d.id != null ? String(d.id).padStart(2, '0') : null;
            const iso = fipsCode && this.fipsToIso[fipsCode] ? this.fipsToIso[fipsCode] : null;
            const stateName = this.isoToStateName[iso] || (this.data?.by_state?.find(s => s.state_iso === iso)?.state_name) || iso || 'Unknown';
            const byType = window.__hubPairsByType;
            const custom = window.__hubPairs || [];
            const findPair = (list) => list?.find(p => typeof stateNameToIso === 'function' && stateNameToIso(p.state) === iso);
            let pair = findPair(custom);
            let typeLabel = '';
            if (!pair && byType) {
                pair = findPair(byType.dual) || findPair(byType.superCore) || findPair(byType.single);
                if (pair) typeLabel = pair.type === 'dual' ? ' (Dual)' : pair.type === 'superCore' ? ' (Super Core)' : ' (Single Edge)';
            }
            let content = 'No hub';
            if (pair) {
                const h1 = pair.hub1 || '';
                const h2 = pair.hub2 || '';
                content = h2 ? `Hub 1: ${h1}<br>Hub 2: ${h2}` : `Hub: ${h1}`;
            }
            this.tooltip.style('opacity', 1).html(`<div class="tooltip-title">${stateName}${typeLabel}</div><div class="tooltip-content">${content}</div>`);
            return;
        }
        
        const stateData = this.getStateDataForFeature(d);
        if (!stateData) {
            this.debugLog('[MapVisualizer] Mouse over state without data');
            this.tooltip.style('opacity', 0);
            return;
        }
        
        this.debugLog(`[MapVisualizer] Mouse over state: ${stateData.state_name} (${stateData.state_iso})`);
        this.tooltip.style('opacity', 1).html(this.generateTooltipContent(stateData));
    }
    
    handleMouseMove(event, d) {
        this.tooltip
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 28) + 'px');
    }
    
    handleMouseOut(event, d) {
        d3.select(event.currentTarget)
            .style('opacity', 1);
        
        this.tooltip.style('opacity', 0);
    }
    
    handleClick(event, d) {
        const stateData = this.getStateDataForFeature(d);
        if (!stateData) return;
        
        this.debugLog('Clicked state:', stateData.state_name, stateData);
        // Could implement drill-down functionality here
    }
    
    generateTooltipContent(stateData) {
        const value = stateData[this.currentMetric];
        const metricLabel = this.getMetricLabel(this.currentMetric);
        const isOthersMetric = this.currentMetric.startsWith('others_');
        const othersNote = isOthersMetric ? '<div class="tooltip-note">Others (carriers) = Cable/Dish, etc. (6.9M total: 5.6 Pre + 1.3 Post)</div>' : '';
        
        return `
            <div class="tooltip-title">${stateData.state_name}</div>
            <div class="tooltip-content">
                <strong>${metricLabel}:</strong> 
                <span class="tooltip-value">${this.formatValue(value)}</span>
            </div>
            ${othersNote}
        `;
    }
    
    getMetricLabel(metric) {
        const labels = {
            'total_subscribers': 'Total Mobile (T)',
            'total_prepaid': 'Total (Pre)',
            'total_postpaid': 'Total (Post)',
            'verizon_total': 'Verizon (T)',
            'verizon_prepaid': 'Verizon (Pre)',
            'verizon_postpaid': 'Verizon (Post)',
            'tmobile_total': 'T-Mobile (T)',
            'tmobile_prepaid': 'T-Mobile (Pre)',
            'tmobile_postpaid': 'T-Mobile (Post)',
            'att_total': 'AT&T (T)',
            'att_prepaid': 'AT&T (Pre)',
            'att_postpaid': 'AT&T (Post)',
            'others_total': 'Others (carriers) (T)',
            'others_prepaid': 'Others (carriers) (Pre)',
            'others_postpaid': 'Others (carriers) (Post)'
        };
        return labels[metric] || metric;
    }
    
    formatValue(value) {
        if (this.currentMetric === 'revenue_inr_cr') {
            if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K Cr`;
            if (value >= 1) return `₹${value.toFixed(0)} Cr`;
            return value != null ? `₹${value}` : '0';
        }
        if (this.currentMetric === 'annual_revenue_b') {
            if (value >= 1) return `$${value.toFixed(1)}B`;
            if (value > 0) return `$${(value * 1000).toFixed(0)}M`;
            return value != null ? `$${value}` : '$0';
        }
        if (this.country === 'india' || this.country === 'india-option-b') {
            if (value >= 1) return `${value.toFixed(1)} Cr`;
            if (value > 0) return `${(value * 10).toFixed(1)} L`;
            return '0';
        }
        if (value >= 1000) return `${(value / 1000).toFixed(2)}B`;
        if (value >= 1) return `${value.toFixed(1)}M`;
        if (value > 0) return `${(value * 1000).toFixed(0)}K`;
        return '0';
    }
    
    updateStats() {
        const totalElement = d3.select('#stat-total');
        const subtitleEl = document.getElementById('stat-total-subtitle');
        const statesElement = d3.select('#stat-states');
        const diffNote = document.getElementById('map-total-note');
        const othersCard = document.getElementById('stat-others-card');
        const othersValue = document.getElementById('stat-others-value');
        const othersLabel = document.getElementById('stat-others-label');
        if (this.country === 'india' || this.country === 'india-option-b') {
            const total = this.data.total_subscribers_display || (this.data.total_subscribers / 1e7).toFixed(2) + ' Cr';
            const stateCount = (this.data.by_state || []).length;
            if (!totalElement.empty()) totalElement.text(total);
            if (subtitleEl) subtitleEl.textContent = 'TRAI / GSMA estimates (Sep 2025)';
            if (!statesElement.empty()) statesElement.text(stateCount);
            if (diffNote) diffNote.innerHTML = `<strong>${total}</strong> total wireless subscribers. Currency: INR.`;
            if (othersCard) othersCard.style.display = 'none';
        } else {
            const MOBILE_SUBSCRIBERS_TOTAL = 333;
            const US_POPULATION_APPROX = 350;
            if (!totalElement.empty()) totalElement.text(`${MOBILE_SUBSCRIBERS_TOTAL}M`);
            if (subtitleEl) subtitleEl.textContent = `of ~${US_POPULATION_APPROX}M total US population`;
            const othersCarriers = this.data.by_state.reduce((s, d) => s + (d.others_total || 0), 0);
            const othersCarriersPost = this.data.by_state.reduce((s, d) => s + (d.others_postpaid || 0), 0);
            const othersCarriersPre = this.data.by_state.reduce((s, d) => s + (d.others_prepaid || 0), 0);
            if (diffNote) diffNote.innerHTML = `<strong>${MOBILE_SUBSCRIBERS_TOTAL}M</strong> total mobile subscribers (of ~${US_POPULATION_APPROX}M US population). <em>Others (carriers)</em>: ${othersCarriers.toFixed(1)}M (${othersCarriersPre.toFixed(1)} Pre + ${othersCarriersPost.toFixed(1)} Post) — Cable/Dish, etc.`;
            if (!statesElement.empty()) statesElement.text(this.data.by_state.filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO).length);
            if (othersCard) othersCard.style.display = '';
            if (othersValue) othersValue.textContent = '32+19';
            if (othersLabel) othersLabel.textContent = 'States (32 shown + 19 in Others)';
        }
    }
    
    async applyMapMode(mode) {
        this.mapMode = mode;
        const metricGroup = document.getElementById('metric-control-group');
        const dcTiersGroup = document.getElementById('dc-tiers-control-group');
        const hubPairsGroup = document.getElementById('hub-pairs-control-group');
        if (metricGroup) metricGroup.style.display = mode === 'subscribers' ? '' : 'none';
        if (dcTiersGroup) dcTiersGroup.style.display = mode === 'dc-tiers' ? '' : 'none';
        if (hubPairsGroup) hubPairsGroup.style.display = mode === 'hub-pairs' ? '' : 'none';
        
        if (mode === 'dc-tiers') {
            window.__dataCenterTiersVisible = {
                tier1: document.getElementById('tier1-toggle')?.checked ?? true,
                tier2: document.getElementById('tier2-toggle')?.checked ?? true,
                tier3: document.getElementById('tier3-toggle')?.checked ?? true
            };
            if (typeof loadDataCenterTiers === 'function') {
                await loadDataCenterTiers();
            }
        }
        
        const isDcMode = ['data-centers', 'dc-tiers', 'hub-pairs'].includes(mode);
        const strokeW = isDcMode ? this.DC_MODE_STROKE_WIDTH : this.STATE_STROKE_WIDTH;
        const strokeC = isDcMode ? this.DC_MODE_STROKE_COLOR : this.STATE_STROKE_COLOR;
        this.g.selectAll('.state')
            .transition().duration(500)
            .attr('fill', d => this.getStateFill(d))
            .attr('stroke', strokeC)
            .attr('stroke-width', strokeW);
        
        if (mode === 'hub-pairs') {
            window.__hubPairsVisible = {
                dual: document.getElementById('hub-dual-toggle')?.checked ?? true,
                single: document.getElementById('hub-single-toggle')?.checked ?? true,
                superCore: document.getElementById('hub-super-toggle')?.checked ?? true
            };
            this.clearStateCentroidDots();
            if (typeof loadHubPairsDefault === 'function') {
                await loadHubPairsDefault();
            }
            this.renderHubPairsDots();
        } else if (mode === 'data-centers' || mode === 'dc-tiers') {
            this.clearHubPairsDots();
            this.renderStateCentroidDots();
        } else {
            this.clearHubPairsDots();
            this.clearStateCentroidDots();
        }
        
        this.renderStateLabels();
        this.updateLegend();
    }
    
    changeMetric(metric) {
        this.debugLog(`[MapVisualizer] Changing metric from '${this.currentMetric}' to '${metric}'`);
        this.currentMetric = metric;
        this.updateColorScale();
        
        // Update state colors
        this.debugLog('[MapVisualizer] Updating state colors with transition (duration: 750ms)');
        this.debugLog(`[MapVisualizer] Maintaining styling: stroke=${this.STATE_STROKE_COLOR}, stroke-width=${this.STATE_STROKE_WIDTH}, fill-opacity=${this.STATE_FILL_OPACITY}`);
        this.g.selectAll('.state')
            .transition()
            .duration(750)
            .attr('fill', d => this.getStateFill(d))
            .attr('stroke', this.STATE_STROKE_COLOR)
            .attr('stroke-width', this.STATE_STROKE_WIDTH)
            .style('fill-opacity', this.STATE_FILL_OPACITY);
        
        // Update state labels with new metric values
        this.updateStateLabels();
        
        this.updateLegend();
    }
    
    resetZoom() {
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, d3.zoomIdentity);
    }
    
    setupEventListeners() {
        // Map mode selector
        const mapModeSelect = document.getElementById('map-mode-select');
        if (mapModeSelect) {
            mapModeSelect.addEventListener('change', (e) => {
                this.applyMapMode(e.target.value);
            });
        }
        
        // DC Tiers toggles
        ['tier1-toggle', 'tier2-toggle', 'tier3-toggle'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    if (this.mapMode === 'dc-tiers') {
                        window.__dataCenterTiersVisible = {
                            tier1: document.getElementById('tier1-toggle')?.checked ?? true,
                            tier2: document.getElementById('tier2-toggle')?.checked ?? true,
                            tier3: document.getElementById('tier3-toggle')?.checked ?? true
                        };
                        this.g.selectAll('.state')
                            .transition().duration(300)
                            .attr('fill', d => this.getStateFill(d));
                        this.renderStateCentroidDots();
                    }
                });
            }
        });
        // Hub Pairs toggles
        ['hub-dual-toggle', 'hub-single-toggle', 'hub-super-toggle'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    if (this.mapMode === 'hub-pairs') {
                        window.__hubPairsVisible = {
                            dual: document.getElementById('hub-dual-toggle')?.checked ?? true,
                            single: document.getElementById('hub-single-toggle')?.checked ?? true,
                            superCore: document.getElementById('hub-super-toggle')?.checked ?? true
                        };
                        this.renderHubPairsDots();
                    }
                });
            }
        });
        
        // Metric selector
        const metricSelect = document.getElementById('metric-select');
        if (metricSelect) {
            metricSelect.addEventListener('change', (e) => {
                this.changeMetric(e.target.value);
            });
        }
        
        // Reset zoom button
        const resetButton = document.getElementById('reset-zoom');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetZoom();
            });
        }
        
        // Optional: Reset zoom on window resize to prevent transform issues
        // Debounced to avoid excessive resetZoom() calls during resizing
        // Store handler reference to allow cleanup if needed
        this.resizeHandler = () => {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = setTimeout(() => {
                this.resetZoom();
            }, 250);  // 250ms debounce delay
        };
        window.addEventListener('resize', this.resizeHandler);
    }
    
    showError(message) {
        const container = d3.select(`#${this.containerId}`);
        container.html(`
            <div class="error-message" style="text-align: center; padding: 50px;">
                <h2>Error</h2>
                <p>${message}</p>
            </div>
        `);
    }
}

// Initialize the map when libraries are ready
(function initializeWhenReady() {
    const MAX_CHECKS = 30; // 30 * 100ms = 3 seconds timeout
    const CHECK_INTERVAL = 100; // ms
    let checkCount = 0;
    let isChecking = false; // Flag to prevent multiple polling chains

    const checkLibraries = () => {
        // Prevent multiple concurrent polling chains
        if (isChecking) {
            return;
        }
        isChecking = true;
        
        const doCheck = () => {
            checkCount++;
            const d3Ready = typeof d3 !== 'undefined' && d3.version;
            const topojsonReady = typeof topojson !== 'undefined';
            
            if (d3Ready && topojsonReady) {
                console.log('[MapVisualizer] Libraries confirmed available, initializing...');
                initializeMap();
            } else if (checkCount >= MAX_CHECKS) {
                console.error('[MapVisualizer] Libraries failed to load after ' + (MAX_CHECKS * CHECK_INTERVAL / 1000) + ' seconds');
                showLoadError();
            } else {
                // Check again after a short delay
                setTimeout(doCheck, CHECK_INTERVAL);
            }
        };
        
        doCheck();
    };

    const updateMetricSelectForCountry = (country) => {
        const sel = document.getElementById('metric-select');
        if (!sel) return;
        const indiaOpts = [
            ['total_subscribers', 'Total (Cr)'],
            ['jio_total', 'Jio (Cr)'],
            ['airtel_total', 'Airtel (Cr)'],
            ['vi_total', 'Vi (Cr)'],
            ['bsnl_total', 'BSNL (Cr)'],
            ['others_total', 'Others (Cr)'],
            ['urban_subscribers', 'Urban (Cr)'],
            ['rural_subscribers', 'Rural (Cr)'],
            ['revenue_inr_cr', 'Revenue (INR Cr)']
        ];
        const usOpts = [
            ['total_subscribers', 'Total Mobile (T)'],
            ['total_prepaid', 'Total (Pre)'],
            ['total_postpaid', 'Total (Post)'],
            ['verizon_total', 'Verizon (T)'],
            ['verizon_prepaid', 'Verizon (Pre)'],
            ['verizon_postpaid', 'Verizon (Post)'],
            ['tmobile_total', 'T-Mobile (T)'],
            ['tmobile_prepaid', 'T-Mobile (Pre)'],
            ['tmobile_postpaid', 'T-Mobile (Post)'],
            ['att_total', 'AT&T (T)'],
            ['att_prepaid', 'AT&T (Pre)'],
            ['att_postpaid', 'AT&T (Post)'],
            ['others_total', 'Others (carriers) (T)'],
            ['others_prepaid', 'Others (carriers) (Pre)'],
            ['others_postpaid', 'Others (carriers) (Post)'],
            ['annual_revenue_b', 'Revenue ($B)']
        ];
        const opts = (country === 'india' || country === 'india-option-b') ? indiaOpts : usOpts;
        sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    };

    const initializeMap = async () => {
        const countrySel = document.getElementById('country-select');
        const country = countrySel ? countrySel.value : 'us';
        window.__country = country;
        updateMetricSelectForCountry(country);
        const visualizer = new MapVisualizer('map-svg-container', country);
        window.__mapVisualizer = visualizer;
        
        try {
            // Show loading state
            d3.select('#map-svg-container').html('<div class="loading"><div class="spinner"></div>Loading visualization...</div>');
            
            await visualizer.initialize();
            visualizer.debugLog('MapVisualizer initialized successfully');
            if (window.__pendingMapMode) {
                const mode = window.__pendingMapMode;
                delete window.__pendingMapMode;
                const modeSel = document.getElementById('map-mode-select');
                if (modeSel) modeSel.value = mode;
                visualizer.applyMapMode(mode);
            }
        } catch (error) {
            console.error('Failed to initialize MapVisualizer:', error);
            visualizer.showError('Failed to load visualization. Please refresh the page.');
        }
    };

    const showLoadError = () => {
        const container = document.getElementById('map-svg-container');
        if (container) {
            container.innerHTML = `
                <div class="loading">
                    <div class="loading-content">
                        <h2>⚠️ Visualization Unavailable</h2>
                        <p>Required libraries failed to load. Please refresh the page.</p>
                        <button onclick="location.reload()">Refresh Page</button>
                    </div>
                </div>
            `;
        }
    };

    const setupCountrySelector = () => {
        const sel = document.getElementById('country-select');
        if (!sel) return;
        sel.addEventListener('change', () => {
            window.__country = sel.value;
            if (typeof window.clearMapCaches === 'function') window.clearMapCaches();
            const dt = document.getElementById('data-table-container');
            if (dt) {
                dt.dataset.loaded = 'false';
                dt.innerHTML = '';
            }
            window.dispatchEvent(new CustomEvent('country-changed', { detail: { country: sel.value } }));
            d3.select('#map-svg-container').html('<div class="loading"><div class="spinner"></div>Loading visualization...</div>');
            initializeMap();
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupCountrySelector();
            checkLibraries();
        }, { once: true });
    } else {
        setupCountrySelector();
        checkLibraries();
    }
})();
