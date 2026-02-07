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
        this.colorScale = null;
        this.projection = null;
        this.path = null;
        this.svg = null;
        this.g = null;
        this.zoom = null;
        this.tooltip = null;
        
        this.width = 960;
        this.height = 600;
        
        // Constants for label rendering
        this.BASE_LABEL_FONT_SIZE = 12;  // Base font size for state labels
        this.OTHERS_AVG_STATE_ISO = 'OTH';  // ISO code for "Others (Avg)" to exclude from map
        
        // Color scheme for choropleth
        this.colorScheme = ['#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b', '#041f47', '#021324'];
        console.log('[MapVisualizer] Color scheme initialized with', this.colorScheme.length, 'colors:', this.colorScheme);
        
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
            console.log('Data loaded:', this.data);
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }
    
    setupSVG() {
        console.log('[MapVisualizer] Setting up SVG canvas');
        const container = d3.select(`#${this.containerId}`);
        container.selectAll('*').remove();
        
        this.svg = container
            .append('svg')
            .attr('id', 'map')
            .attr('width', '100%')
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        
        console.log(`[MapVisualizer] SVG dimensions: ${this.width}x${this.height}`);
        
        // Create container group for zoom
        this.g = this.svg.append('g');
        
        // Setup projection for US map
        this.projection = d3.geoAlbersUsa()
            .translate([this.width / 2, this.height / 2])
            .scale(1200);
        
        console.log('[MapVisualizer] Projection configured: AlbersUsa, scale=1200');
        
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
    
    async renderMap() {
        try {
            // Load US states TopoJSON from D3.js CDN
            // This file uses numeric FIPS codes as feature.id
            const us = await d3.json('https://d3js.org/us-10m.v1.json')
                .catch((err) => {
                    console.error('Failed to load TopoJSON from CDN:', err);
                    console.log('Using fallback map data');
                    return this.createFallbackMapData();
                });
            
            // Validate TopoJSON structure
            if (!us || !us.objects || !us.objects.states) {
                console.error('Invalid TopoJSON structure:', us);
                console.warn('Expected us.objects.states to exist. Using fallback map data.');
                this.showError('Map data is unavailable. Please refresh the page.');
                return;
            }
            
            // Convert TopoJSON to GeoJSON
            const states = topojson.feature(us, us.objects.states);
            
            console.log(`Loaded ${states.features.length} state features from TopoJSON`);
            
            // Validate that we have features
            if (!states.features || states.features.length === 0) {
                console.error('No state features found in TopoJSON');
                this.showError('Map data is empty. Please refresh the page.');
                return;
            }
            
            // Setup color scale based on current metric
            this.updateColorScale();
            
            // Draw states with proper data matching
            console.log('[MapVisualizer] Drawing states with styling: stroke=#ffffff, stroke-width=1.5, fill-opacity=0.85');
            const statePaths = this.g.selectAll('.state')
                .data(states.features)
                .join('path')
                .attr('class', 'state')
                .attr('d', this.path)
                .attr('fill', d => {
                    const stateData = this.getStateDataForFeature(d);
                    if (!stateData) {
                        // Use neutral fill for states without data
                        console.log('[MapVisualizer] State without data, using neutral color #cccccc:', d);
                        return '#cccccc';
                    }
                    const color = this.colorScale(stateData[this.currentMetric]);
                    console.log(`[MapVisualizer] State ${stateData.state_iso} (${stateData.state_name}): value=${stateData[this.currentMetric]}, color=${color}`);
                    return color;
                })
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 1.5)
                .style('fill-opacity', 0.85)
                .on('mouseover', (event, d) => this.handleMouseOver(event, d))
                .on('mousemove', (event, d) => this.handleMouseMove(event, d))
                .on('mouseout', (event, d) => this.handleMouseOut(event, d))
                .on('click', (event, d) => this.handleClick(event, d));
            
            console.log('[MapVisualizer] Total state paths created:', statePaths.size());
            
            // Log matching statistics for debugging
            const matchedStates = states.features.filter(f => this.getStateDataForFeature(f) !== null).length;
            console.log(`Matched ${matchedStates} out of ${states.features.length} states to data`);
            
            // Render state labels using lat/long coordinates
            this.renderStateLabels();
            
            // Update legend
            this.updateLegend();
            
        } catch (error) {
            console.error('Error rendering map:', error);
            // Show error message
            this.showError('Error loading map visualization. Please refresh the page.');
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
    
    renderStateLabels() {
        /**
         * Render text labels on each state using latitude/longitude coordinates.
         * Labels show the current metric value for each state.
         * Excludes "Others (Avg)" from display as per requirements.
         */
        
        // Remove any existing labels
        this.g.selectAll('.state-label').remove();
        
        // Get state data excluding "Others (Avg)"
        const stateData = this.data.by_state.filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO);
        
        // Add labels for each state using lat/long coordinates
        const labels = this.g.selectAll('.state-label')
            .data(stateData)
            .join('text')
            .attr('class', 'state-label')
            .attr('x', d => {
                // Convert lat/long to screen coordinates using projection
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
            .text(d => {
                const value = d[this.currentMetric];
                return this.formatValue(value);
            });
        
        // Store reference to labels for zoom updates
        this.labels = labels;
    }
    
    updateStateLabels() {
        /**
         * Update state labels with new metric values and handle zoom-based visibility.
         */
        if (!this.labels || this.labels.empty()) return;
        
        this.labels
            .transition()
            .duration(500)
            .text(d => {
                const value = d[this.currentMetric];
                return this.formatValue(value);
            });
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
        
        console.log(`[MapVisualizer] Updating color scale for metric '${this.currentMetric}'`);
        console.log('[MapVisualizer] Value extent:', extent, 'min:', extent[0], 'max:', extent[1]);
        console.log('[MapVisualizer] Number of data points:', values.length);
        
        this.colorScale = d3.scaleQuantize()
            .domain(extent)
            .range(this.colorScheme);
        
        console.log('[MapVisualizer] Color scale domain:', this.colorScale.domain());
        console.log('[MapVisualizer] Color scale range:', this.colorScale.range());
    }
    
    updateLegend() {
        const legendContainer = d3.select('#legend-scale');
        if (legendContainer.empty()) return;
        
        legendContainer.selectAll('*').remove();
        
        const legendWidth = legendContainer.node().clientWidth;
        const segmentWidth = legendWidth / this.colorScheme.length;
        
        this.colorScheme.forEach((color, i) => {
            legendContainer.append('div')
                .style('background-color', color)
                .style('width', `${segmentWidth}px`)
                .style('height', '100%')
                .style('display', 'inline-block');
        });
        
        // Update legend labels
        const values = this.data.by_state
            .filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO)
            .map(d => d[this.currentMetric]);
        
        const extent = d3.extent(values);
        const minLabel = d3.select('#legend-min');
        const maxLabel = d3.select('#legend-max');
        
        if (!minLabel.empty() && !maxLabel.empty()) {
            minLabel.text(this.formatValue(extent[0]));
            maxLabel.text(this.formatValue(extent[1]));
        }
    }
    
    handleMouseOver(event, d) {
        const stateData = this.getStateDataForFeature(d);
        if (!stateData) {
            console.log('[MapVisualizer] Mouse over state without data');
            return;
        }
        
        console.log(`[MapVisualizer] Mouse over state: ${stateData.state_name} (${stateData.state_iso})`);
        
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
        
        console.log('Clicked state:', stateData.state_name, stateData);
        // Could implement drill-down functionality here
    }
    
    generateTooltipContent(stateData) {
        const value = stateData[this.currentMetric];
        const metricLabel = this.getMetricLabel(this.currentMetric);
        
        return `
            <div class="tooltip-title">${stateData.state_name}</div>
            <div class="tooltip-content">
                <strong>${metricLabel}:</strong> 
                <span class="tooltip-value">${this.formatValue(value)}</span>
            </div>
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
            'others_total': 'Others (T)',
            'others_prepaid': 'Others (Pre)',
            'others_postpaid': 'Others (Post)'
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
        // Update total subscribers
        const totalElement = d3.select('#stat-total');
        if (!totalElement.empty()) {
            const totalMillions = this.data.by_state
                .filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO)
                .reduce((sum, d) => sum + d.total_subscribers, 0);
            totalElement.text(`${totalMillions.toFixed(1)}M`);
        }
        
        // Update number of states
        const statesElement = d3.select('#stat-states');
        if (!statesElement.empty()) {
            const stateCount = this.data.by_state.filter(d => d.state_iso !== this.OTHERS_AVG_STATE_ISO).length;
            statesElement.text(stateCount);
        }
    }
    
    changeMetric(metric) {
        console.log(`[MapVisualizer] Changing metric from '${this.currentMetric}' to '${metric}'`);
        this.currentMetric = metric;
        this.updateColorScale();
        
        // Update state colors
        console.log('[MapVisualizer] Updating state colors with transition (duration: 750ms)');
        console.log('[MapVisualizer] Maintaining styling: stroke=#ffffff, stroke-width=1.5, fill-opacity=0.85');
        this.g.selectAll('.state')
            .transition()
            .duration(750)
            .attr('fill', d => {
                const stateData = this.getStateDataForFeature(d);
                if (!stateData) return '#cccccc';
                return this.colorScale(stateData[this.currentMetric]);
            })
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.5)
            .style('fill-opacity', 0.85);
        
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

// Initialize the map when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const visualizer = new MapVisualizer('map-svg-container');
    
    try {
        // Show loading state
        d3.select('#map-svg-container').html('<div class="loading"><div class="spinner"></div>Loading visualization...</div>');
        
        await visualizer.initialize();
        console.log('MapVisualizer initialized successfully');
    } catch (error) {
        console.error('Failed to initialize MapVisualizer:', error);
        visualizer.showError('Failed to load visualization. Please refresh the page.');
    }
});
