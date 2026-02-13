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
    constructor(containerId) {
        this.containerId = containerId;
        this.data = null;
        this.currentMetric = 'total_subscribers';
        this.mapMode = 'subscribers';  // 'subscribers' | 'data-centers' | 'hub-pairs'
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
            const response = await fetch('/api/mobile/data');
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
        
        // Setup projection for US map
        this.projection = d3.geoAlbersUsa()
            .translate([this.width / 2, this.height / 2])
            .scale(1200);
        
        this.debugLog('[MapVisualizer] Projection configured: AlbersUsa, scale=1200');
        
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
     * Load topology data with local-first approach and CDN fallback
     */
    async loadTopology() {
        const localPath = '/api/geo/topojson/states';
        // Use states-only TopoJSON (object "states"); d3js.org/us-10m.v1 has "counties" and may not have "states"
        const cdnPath = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
        
        try {
            console.log('Attempting to load topology from local server...');
            const us = await d3.json(localPath);
            console.log('✓ Loaded topology from local server');
            return us;
        } catch (localError) {
            console.warn('Local topology failed:', localError.message);
            console.log('Attempting to load topology from CDN fallback...');
            
            try {
                const us = await d3.json(cdnPath);
                console.log('✓ Loaded topology from CDN fallback');
                return us;
            } catch (cdnError) {
                console.error('✗ Both local and CDN topology failed');
                throw new Error('Unable to load map data from any source. Local: ' + localError.message + ', CDN: ' + cdnError.message);
            }
        }
    }

    async renderMap() {
        try {
            // Load US states TopoJSON using local-first approach
            // This file uses numeric FIPS codes as feature.id
            const us = await this.loadTopology();
            
            // Validate TopoJSON structure
            if (!us || !us.objects || !us.objects.states) {
                console.error('Invalid TopoJSON structure:', us);
                console.warn('Expected us.objects.states to exist.');
                this.showError('Map data is unavailable. Please refresh the page.');
                return;
            }
            
            // NEW: Validate arcs array exists and is not empty
            if (!us.arcs || us.arcs.length === 0) {
                console.error('TopoJSON has no arc data - placeholder file detected');
                this.showError('Map topology data is incomplete. Please run ./scripts/download_dependencies.sh to download actual map data.');
                return;
            }
            
            // Convert TopoJSON to GeoJSON
            const states = topojson.feature(us, us.objects.states);
            
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
            const statePaths = this.g.selectAll('.state')
                .data(states.features)
                .join('path')
                .attr('class', 'state')
                .attr('d', this.path)
                .attr('fill', d => this.getStateFill(d))
                .attr('stroke', this.STATE_STROKE_COLOR)
                .attr('stroke-width', this.STATE_STROKE_WIDTH)
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
        /**
         * Match a TopoJSON feature to our subscriber data.
         * 
         * TopoJSON features use numeric FIPS codes (e.g., "06" for California)
         * Our data uses ISO-2 codes (e.g., "CA" for California)
         * 
         * Strategy:
         * 1. Try to get FIPS code from feature.id (numeric)
         * 2. Convert FIPS to ISO-2 using lookup table
         * 3. Find matching state in our data by ISO-2 code
         * 4. Fallback to name matching if FIPS lookup fails
         */
        
        // Get FIPS code from feature
        let fipsCode = null;
        if (feature.id !== undefined && feature.id !== null) {
            // Convert to zero-padded string
            fipsCode = String(feature.id).padStart(2, '0');
        }
        
        // Try FIPS to ISO-2 lookup
        if (fipsCode && this.fipsToIso[fipsCode]) {
            const isoCode = this.fipsToIso[fipsCode];
            const stateData = this.data.by_state.find(d => 
                d.state_iso === isoCode && d.state_iso !== this.OTHERS_AVG_STATE_ISO
            );
            if (stateData) {
                return stateData;
            }
        }
        
        // Fallback: Try matching by feature.properties.name if available
        if (feature.properties && feature.properties.name) {
            const featureName = feature.properties.name;
            const stateData = this.data.by_state.find(d => {
                if (!d.state_name || d.state_iso === 'OTH') return false;
                return d.state_name.toLowerCase() === featureName.toLowerCase();
            });
            if (stateData) {
                return stateData;
            }
        }
        
        return null;
    }
    
    /**
     * Get fill color for a state feature based on current map mode.
     */
    getStateFill(d) {
        if (this.mapMode === 'data-centers') {
            const stateValues = window.__dataCentersStateValues || {};
            const fipsCode = d.id != null ? String(d.id).padStart(2, '0') : null;
            const iso = fipsCode && this.fipsToIso[fipsCode] ? this.fipsToIso[fipsCode] : null;
            const value = iso ? (stateValues[iso] || '').trim() : '';
            if (!value || value === 'None') return '#e2e8f0';
            if (/super\s*core/i.test(value)) return '#0868ac';
            return '#43a2ca';
        }
        if (this.mapMode === 'hub-pairs') {
            return '#e2e8f0';
        }
        const stateData = this.getStateDataForFeature(d);
        if (!stateData) return '#e2e8f0';
        return this.colorScale(stateData[this.currentMetric]);
    }
    
    renderStateLabels() {
        /**
         * Render text labels on each state using latitude/longitude coordinates.
         * Labels show the current metric value for each state.
         * Excludes "Others (Avg)" from display as per requirements.
         * In data-centers/hub-pairs mode, labels are hidden.
         */
        
        // Remove any existing labels
        this.g.selectAll('.state-label').remove();
        
        if (this.mapMode !== 'subscribers') return;
        
        // Get state data excluding "Others (Avg)"
        const stateData = this.data.by_state.filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO);
        
        // Add labels for each state: state name (small) + subscriber value
        const mapviz = this;
        const labels = this.g.selectAll('.state-label')
            .data(stateData)
            .join('text')
            .attr('class', 'state-label')
            .attr('x', d => {
                const coords = this.projection([d.longitude, d.latitude]);
                return coords ? coords[0] : 0;
            })
            .attr('y', d => {
                const coords = this.projection([d.longitude, d.latitude]);
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
        const values = this.data.by_state
            .filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO)
            .map(d => d[this.currentMetric]);
        
        const extent = d3.extent(values);
        
        this.debugLog(`[MapVisualizer] Updating color scale for metric '${this.currentMetric}'`);
        this.debugLog('[MapVisualizer] Value extent:', extent, 'min:', extent[0], 'max:', extent[1]);
        this.debugLog('[MapVisualizer] Number of data points:', values.length);
        
        this.colorScale = d3.scaleQuantize()
            .domain(extent)
            .range(this.colorScheme);
        
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
            legendContainer.append('div').style('background-color', '#0868ac').style('flex', '1').style('height', '100%').style('min-width', '60px');
            legendContainer.append('div').style('background-color', '#43a2ca').style('flex', '1').style('height', '100%').style('min-width', '60px');
            legendContainer.append('div').style('background-color', '#e2e8f0').style('flex', '1').style('height', '100%').style('min-width', '60px');
            legendContainer.style('display', 'flex');
            if (!minLabel.empty()) minLabel.text('Super Core');
            if (!maxLabel.empty()) maxLabel.text('No DC');
            return;
        }
        if (this.mapMode === 'hub-pairs') {
            legendContainer.append('div').style('background-color', '#e2e8f0').style('flex', '1').style('height', '100%');
            if (!minLabel.empty()) minLabel.text('Hub pairs');
            if (!maxLabel.empty()) maxLabel.text('');
            return;
        }
        
        const legendWidth = legendContainer.node().clientWidth;
        const segmentWidth = legendWidth / this.colorScheme.length;
        
        this.colorScheme.forEach((color) => {
            legendContainer.append('div')
                .style('background-color', color)
                .style('width', `${segmentWidth}px`)
                .style('height', '100%')
                .style('display', 'inline-block');
        });
        
        const values = this.data.by_state
            .filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO)
            .map(d => d[this.currentMetric]);
        const extent = d3.extent(values);
        if (!minLabel.empty() && !maxLabel.empty()) {
            minLabel.text(this.formatValue(extent[0]));
            maxLabel.text(this.formatValue(extent[1]));
        }
    }
    
    clearHubPairsDots() {
        this.g.selectAll('.hub-dots-layer').remove();
    }
    
    renderHubPairsDots() {
        this.clearHubPairsDots();
        const pairs = window.__hubPairs || [];
        if (pairs.length === 0) return;
        const layer = this.g.append('g').attr('class', 'hub-dots-layer');
        pairs.forEach(p => {
            const p1 = this.projection(p.c1);
            const p2 = this.projection(p.c2);
            if (p1 && p2) {
                layer.append('line')
                    .attr('x1', p1[0]).attr('y1', p1[1]).attr('x2', p2[0]).attr('y2', p2[1])
                    .attr('stroke', p.color).attr('stroke-width', 2).attr('stroke-opacity', 0.6);
            }
            if (p1) {
                layer.append('circle')
                    .attr('cx', p1[0]).attr('cy', p1[1])
                    .attr('r', 5).attr('fill', p.color).attr('stroke', '#1f2937').attr('stroke-width', 1);
            }
            if (p2) {
                layer.append('circle')
                    .attr('cx', p2[0]).attr('cy', p2[1])
                    .attr('r', 5).attr('fill', p.color).attr('stroke', '#1f2937').attr('stroke-width', 1);
            }
        });
    }
    
    handleMouseOver(event, d) {
        const stateData = this.getStateDataForFeature(d);
        if (!stateData) {
            this.debugLog('[MapVisualizer] Mouse over state without data');
            return;
        }
        
        this.debugLog(`[MapVisualizer] Mouse over state: ${stateData.state_name} (${stateData.state_iso})`);
        
        d3.select(event.currentTarget)
            .style('opacity', 0.8);
        
        this.tooltip
            .style('opacity', 1)
            .html(this.generateTooltipContent(stateData));
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
        // Values are in millions (M), format appropriately
        if (value >= 1000) {
            // Convert to billions
            return `${(value / 1000).toFixed(2)}B`;
        } else if (value >= 1) {
            // Show as millions
            return `${value.toFixed(1)}M`;
        } else if (value > 0) {
            // Show as thousands for values < 1M
            return `${(value * 1000).toFixed(0)}K`;
        }
        return '0';
    }
    
    updateStats() {
        // Total subscribers (all 33 rows: 32 states + Others aggregate)
        const totalElement = d3.select('#stat-total');
        const totalMillions = this.data.by_state.reduce((sum, d) => sum + d.total_subscribers, 0);
        const displayTotal = Math.round(totalMillions * 10) / 10; // Avoid float drift, match 333.0
        if (!totalElement.empty()) {
            totalElement.text(`${displayTotal}M`);
        }
        // Others (carriers) = 6.9M (5.6 Pre + 1.3 Post) - non-Big3 carriers
        const othersCarriers = this.data.by_state.reduce((s, d) => s + d.others_total, 0);
        const othersCarriersPost = this.data.by_state.reduce((s, d) => s + d.others_postpaid, 0);
        const othersCarriersPre = this.data.by_state.reduce((s, d) => s + d.others_prepaid, 0);
        const diffNote = document.getElementById('map-total-note');
        if (diffNote) {
            const diff = Math.abs(displayTotal - 333);
            const diffText = diff >= 0.01 ? ` <span class="total-diff">(Δ ${(displayTotal - 333).toFixed(2)}M vs 333.0)</span>` : '';
            diffNote.innerHTML = `Total: <strong>${displayTotal}M</strong>${diffText}. <em>Others (carriers)</em>: ${othersCarriers.toFixed(1)}M (${othersCarriersPre.toFixed(1)} Pre + ${othersCarriersPost.toFixed(1)} Post) — Cable/Dish, etc.`;
        }
        // States shown on map (32 individual, excluding Others aggregate)
        const statesElement = d3.select('#stat-states');
        if (!statesElement.empty()) {
            const stateCount = this.data.by_state.filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO).length;
            statesElement.text(stateCount);
        }
    }
    
    applyMapMode(mode) {
        this.mapMode = mode;
        const metricGroup = document.getElementById('metric-control-group');
        if (metricGroup) metricGroup.style.display = mode === 'subscribers' ? '' : 'none';
        
        this.g.selectAll('.state')
            .transition().duration(500)
            .attr('fill', d => this.getStateFill(d));
        
        if (mode === 'hub-pairs') {
            this.renderHubPairsDots();
        } else {
            this.clearHubPairsDots();
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

    const initializeMap = async () => {
        const visualizer = new MapVisualizer('map-svg-container');
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

    // Start checking - handle both cases robustly
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkLibraries, { once: true });
    } else {
        // DOM is already ready, start immediately
        checkLibraries();
    }
})();
