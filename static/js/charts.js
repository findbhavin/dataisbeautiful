/**
 * MapVisual Chart Components
 * D3-based bar, pie, and grouped charts for analytics data
 */

const ChartColors = {
    verizon: '#cd040b',
    tmobile: '#e20074',
    att: '#00a8e0',
    others: '#6b7280',
    neutral: ['#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c']
};

async function renderMarketSharePie(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.market_share) return;

    const width = 400, height = 400, radius = Math.min(width, height) / 2 - 40;
    const svg = container.append('svg').attr('width', width).attr('height', height)
        .append('g').attr('transform', `translate(${width/2},${height/2})`);

    const color = d3.scaleOrdinal()
        .domain(data.market_share.map(d => d.carrier))
        .range([ChartColors.verizon, ChartColors.tmobile, ChartColors.att, ChartColors.others]);

    const pie = d3.pie().value(d => d.subscriber_share_pct).sort(null);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);
    const arcLabel = d3.arc().innerRadius(radius * 0.7).outerRadius(radius * 0.7);

    const arcs = svg.selectAll('arc').data(pie(data.market_share)).join('g');
    arcs.append('path').attr('d', arc).attr('fill', d => color(d.data.carrier)).attr('stroke', '#fff').attr('stroke-width', 2);
    arcs.append('text').attr('transform', d => `translate(${arcLabel.centroid(d)})`).attr('text-anchor', 'middle')
        .attr('fill', '#fff').attr('font-size', 11).attr('font-weight', 'bold')
        .text(d => `${d.data.carrier.split(' ')[0]}\n${d.data.subscriber_share_pct}%`);

    // Legend
    const legend = container.append('div').attr('class', 'chart-legend').style('margin-top', '10px');
    data.market_share.forEach(d => {
        legend.append('div').style('display', 'inline-block').style('margin-right', '16px').style('font-size', '12px')
            .html(`<span style="display:inline-block;width:12px;height:12px;background:${color(d.carrier)};margin-right:4px;border-radius:2px"></span>${d.carrier}: ${d.insight}`);
    });
}

async function renderMetrosBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.top10_metros) return;

    const margin = { top: 20, right: 30, bottom: 80, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const metros = data.top10_metros;
    const keys = ['verizon', 'tmobile', 'att', 'others'];
    const colors = { verizon: ChartColors.verizon, tmobile: ChartColors.tmobile, att: ChartColors.att, others: ChartColors.others };

    const x0 = d3.scaleBand().domain(metros.map(d => d.metro)).range([0, width]).padding(0.2);
    const x1 = d3.scaleBand().domain(keys).range([0, x0.bandwidth()]).padding(0.05);
    const y = d3.scaleLinear().domain([0, d3.max(metros, d => d3.max(keys, k => d[k]))]).range([height, 0]);

    const g = svg.append('g');
    metros.forEach((metro, i) => {
        const gBar = g.append('g').attr('transform', `translate(${x0(metro.metro)},0)`);
        keys.forEach((key, j) => {
            gBar.append('rect').attr('x', x1(key)).attr('y', y(metro[key])).attr('width', x1.bandwidth())
                .attr('height', height - y(metro[key])).attr('fill', colors[key]);
        });
    });

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x0)).selectAll('text')
        .attr('transform', 'rotate(-35)').style('text-anchor', 'end');
    svg.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => d + 'M'));

    const legend = container.append('div').attr('class', 'chart-legend').style('margin-top', '8px');
    ['Verizon', 'T-Mobile', 'AT&T', 'Others'].forEach((name, i) => {
        legend.append('span').style('margin-right', '16px').style('font-size', '12px')
            .html(`<span style="display:inline-block;width:12px;height:12px;background:${Object.values(colors)[i]};margin-right:4px"></span>${name}`);
    });
}

// Table input: parse CSV or JSON and render a simple bar chart
function parseTableInput() {
    const textarea = document.getElementById('table-input-area');
    const output = document.getElementById('table-output-viz');
    output.innerHTML = '';
    const raw = textarea?.value?.trim();
    if (!raw) {
        output.innerHTML = '<p class="error">Please paste CSV or JSON data.</p>';
        return;
    }
    let rows = [];
    try {
        if (raw.startsWith('[') || raw.startsWith('{')) {
            const parsed = JSON.parse(raw);
            rows = Array.isArray(parsed) ? parsed : (parsed.rows || parsed.data || [parsed]);
        } else {
            const lines = raw.split(/\r?\n/).filter(l => l.trim());
            const headers = lines[0].split(/[,;\t]/).map(h => h.trim());
            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].split(/[,;\t]/).map(v => v.trim());
                const obj = {};
                headers.forEach((h, j) => { obj[h] = isNaN(vals[j]) ? vals[j] : parseFloat(vals[j]); });
                rows.push(obj);
            }
        }
    } catch (e) {
        output.innerHTML = '<p class="error">Parse error: ' + e.message + '</p>';
        return;
    }
    if (rows.length === 0) {
        output.innerHTML = '<p class="error">No rows found.</p>';
        return;
    }
    const keys = Object.keys(rows[0]);
    const labelKey = keys.find(k => typeof rows[0][k] === 'string' || isNaN(rows[0][k])) || keys[0];
    const valueKey = keys.find(k => k !== labelKey && !isNaN(rows[0][k])) || keys[1];
    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    const svg = d3.select('#table-output-viz').append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleBand().domain(rows.map(d => String(d[labelKey]))).range([0, width]).padding(0.2);
    const y = d3.scaleLinear().domain([0, d3.max(rows, d => +d[valueKey] || 0)]).range([height, 0]);
    svg.selectAll('rect').data(rows).join('rect')
        .attr('x', d => x(String(d[labelKey]))).attr('y', d => y(+d[valueKey] || 0)).attr('width', x.bandwidth())
        .attr('height', d => height - y(+d[valueKey] || 0)).attr('fill', '#4292c6');
    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x)).selectAll('text').attr('transform', 'rotate(-35)').style('text-anchor', 'end');
    svg.append('g').call(d3.axisLeft(y));
    output.insertAdjacentHTML('afterbegin', '<p class="success">Parsed ' + rows.length + ' rows. Label: ' + labelKey + ', Value: ' + valueKey + '</p>');
}

async function renderSpectrumBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.spectrum_depth_nationwide) return;

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 700 - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const bands = data.spectrum_depth_nationwide;
    const keys = ['tmobile_mhz', 'att_mhz', 'verizon_mhz'];
    const colors = [ChartColors.tmobile, ChartColors.att, ChartColors.verizon];
    const labels = ['T-Mobile', 'AT&T', 'Verizon'];

    const x0 = d3.scaleBand().domain(bands.map(d => d.band)).range([0, width]).padding(0.2);
    const x1 = d3.scaleBand().domain(keys).range([0, x0.bandwidth()]).padding(0.05);
    const y = d3.scaleLinear().domain([0, 450]).range([height, 0]);

    bands.forEach((band, i) => {
        const g = svg.append('g').attr('transform', `translate(${x0(band.band)},0)`);
        keys.forEach((key, j) => {
            g.append('rect').attr('x', x1(key)).attr('y', y(band[key])).attr('width', x1.bandwidth())
                .attr('height', height - y(band[key])).attr('fill', colors[j]);
        });
    });

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x0)).selectAll('text')
        .attr('transform', 'rotate(-25)').style('text-anchor', 'end');
    svg.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' MHz'));
}

async function renderRevenueBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.revenue_top10) return;

    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    const width = 700 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const states = data.revenue_top10;
    const x = d3.scaleBand().domain(states.map(d => d.state)).range([0, width]).padding(0.2);
    const y = d3.scaleLinear().domain([0, d3.max(states, d => d.annual_revenue_b)]).range([height, 0]);

    svg.selectAll('rect').data(states).join('rect')
        .attr('x', d => x(d.state)).attr('y', d => y(d.annual_revenue_b)).attr('width', x.bandwidth())
        .attr('height', d => height - y(d.annual_revenue_b)).attr('fill', ChartColors.neutral[2]);

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x)).selectAll('text')
        .attr('transform', 'rotate(-35)').style('text-anchor', 'end');
    svg.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => '$' + d + 'B'));
}

// Lazy-load chart data and render
async function loadMarketShare() {
    const data = await fetch('/api/analytics/market-wide').then(r => r.json());
    await renderMarketSharePie('chart-market-share', data);
}
async function loadMetros() {
    const data = await fetch('/api/analytics/metros').then(r => r.json());
    await renderMetrosBar('chart-metros', data);
}
async function loadSpectrum() {
    const data = await fetch('/api/analytics/spectrum').then(r => r.json());
    await renderSpectrumBar('chart-spectrum', data);
}
async function loadRevenue() {
    const data = await fetch('/api/analytics/revenue-by-state').then(r => r.json());
    await renderRevenueBar('chart-revenue', data);
}
async function loadTopStates() {
    const data = await fetch('/api/analytics/market-wide').then(r => r.json());
    await renderTopStatesBar('chart-top-states', data);
}

async function renderTopStatesBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.top10_states) return;

    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    const width = 700 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const states = data.top10_states;
    const x = d3.scaleBand().domain(states.map(d => d.state)).range([0, width]).padding(0.2);
    const y = d3.scaleLinear().domain([0, 45]).range([height, 0]);

    svg.selectAll('rect').data(states).join('rect')
        .attr('x', d => x(d.state)).attr('y', d => y(d.customers_m)).attr('width', x.bandwidth())
        .attr('height', d => height - y(d.customers_m)).attr('fill', ChartColors.neutral[3]);

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x)).selectAll('text')
        .attr('transform', 'rotate(-35)').style('text-anchor', 'end');
    svg.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => d + 'M'));
}
