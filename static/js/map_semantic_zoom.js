/**
 * MapVisual Semantic Zoom Map
 * Interactive D3.js visualization with semantic zoom capabilities
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
        
        // Color scheme for choropleth
        this.colorScheme = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'];
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
        const container = d3.select(`#${this.containerId}`);
        container.selectAll('*').remove();
        
        this.svg = container
            .append('svg')
            .attr('id', 'map')
            .attr('width', '100%')
            .attr('height', this.height)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
        
        // Create container group for zoom
        this.g = this.svg.append('g');
        
        // Setup projection for US map
        this.projection = d3.geoAlbersUsa()
            .translate([this.width / 2, this.height / 2])
            .scale(1200);
        
        this.path = d3.geoPath().projection(this.projection);
        
        // Setup zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
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
            // For MVP, we'll use a simple US map from a public source
            // In production, use the TopoJSON files from /api/geo/topojson/states
            
            // Load US states TopoJSON from a CDN fallback or use simplified data
            const us = await d3.json('https://d3js.org/us-10m.v1.json')
                .catch(() => {
                    console.log('Using fallback map data');
                    return this.createFallbackMapData();
                });
            
            if (!us || !us.objects || !us.objects.states) {
                console.warn('Invalid map data, using fallback');
                us = this.createFallbackMapData();
            }
            
            // Convert TopoJSON to GeoJSON
            const states = topojson.feature(us, us.objects.states);
            
            // Setup color scale based on current metric
            this.updateColorScale();
            
            // Create state ID to data mapping
            const dataByStateId = new Map();
            this.data.by_state.forEach(d => {
                if (d.state_iso && d.state_iso !== 'OTH') {
                    dataByStateId.set(d.state_iso, d);
                }
            });
            
            // Draw states
            this.g.selectAll('.state')
                .data(states.features)
                .join('path')
                .attr('class', 'state')
                .attr('d', this.path)
                .attr('fill', d => {
                    const stateData = this.getStateDataById(d.id);
                    if (!stateData) return '#cccccc';
                    return this.colorScale(stateData[this.currentMetric]);
                })
                .on('mouseover', (event, d) => this.handleMouseOver(event, d))
                .on('mousemove', (event, d) => this.handleMouseMove(event, d))
                .on('mouseout', (event, d) => this.handleMouseOut(event, d))
                .on('click', (event, d) => this.handleClick(event, d));
            
            // Update legend
            this.updateLegend();
            
        } catch (error) {
            console.error('Error rendering map:', error);
            // Show error message
            this.showError('Error loading map visualization');
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
    
    getStateDataById(stateId) {
        // Try to match state by ID (FIPS code) or name
        return this.data.by_state.find(d => {
            if (!d.state_iso || d.state_iso === 'OTH') return false;
            
            // Try matching by FIPS code
            if (stateId === d.state_iso) return true;
            
            // Try matching by state name
            if (d.state_name && stateId && 
                d.state_name.toLowerCase() === stateId.toLowerCase()) return true;
            
            return false;
        });
    }
    
    updateColorScale() {
        const values = this.data.by_state
            .filter(d => d.state_iso !== 'OTH')
            .map(d => d[this.currentMetric]);
        
        const extent = d3.extent(values);
        
        this.colorScale = d3.scaleQuantize()
            .domain(extent)
            .range(this.colorScheme);
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
            .filter(d => d.state_iso !== 'OTH')
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
        const stateData = this.getStateDataById(d.id);
        if (!stateData) return;
        
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
        const stateData = this.getStateDataById(d.id);
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
            'total_subscribers': 'Total Subscribers',
            'total_prepaid': 'Prepaid Subscribers',
            'total_postpaid': 'Postpaid Subscribers',
            'verizon_total': 'Verizon Subscribers',
            'tmobile_total': 'T-Mobile Subscribers',
            'att_total': 'AT&T Subscribers',
            'others_total': 'Other Carriers'
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
                .filter(d => d.state_iso !== 'OTH')
                .reduce((sum, d) => sum + d.total_subscribers, 0);
            totalElement.text(`${totalMillions.toFixed(1)}M`);
        }
        
        // Update number of states
        const statesElement = d3.select('#stat-states');
        if (!statesElement.empty()) {
            const stateCount = this.data.by_state.filter(d => d.state_iso !== 'OTH').length;
            statesElement.text(stateCount);
        }
    }
    
    changeMetric(metric) {
        this.currentMetric = metric;
        this.updateColorScale();
        
        // Update state colors
        this.g.selectAll('.state')
            .transition()
            .duration(750)
            .attr('fill', d => {
                const stateData = this.getStateDataById(d.id);
                if (!stateData) return '#cccccc';
                return this.colorScale(stateData[this.currentMetric]);
            });
        
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
