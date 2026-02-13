/**
 * MapVisual Chart Components
 * Modern D3 visualizations following 2024 best practices:
 * - Donut for market share (center metric, easier comparison)
 * - Horizontal bars for long labels (metros, states)
 * - Tooltips, animations, rounded corners
 * - Colorblind-friendly palettes where applicable
 */

const ChartColors = {
    verizon: '#cd040b',
    tmobile: '#e20074',
    att: '#00a8e0',
    others: '#6b7280',
    neutral: ['#7eb5d3', '#5a9fc9', '#4287b8', '#2d6ba3', '#1a4d7a'],
    // ColorBrewer YlGnBu-inspired (colorblind-friendly sequential)
    sequential: ['#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#2c7fb8', '#253494']
};

// Shared chart tooltip
function chartTooltip() {
    let tip = d3.select('body').select('.chart-tooltip');
    if (tip.empty()) {
        tip = d3.select('body').append('div').attr('class', 'chart-tooltip')
            .style('position', 'absolute').style('pointer-events', 'none')
            .style('opacity', 0).style('z-index', 1000)
            .style('background', 'rgba(0,0,0,0.9)').style('color', '#fff')
            .style('padding', '8px 12px').style('border-radius', '8px')
            .style('font-size', '13px').style('max-width', '280px');
    }
    return tip;
}

function showTooltip(event, html) {
    const tip = chartTooltip();
    tip.html(html).style('opacity', 1)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 8) + 'px');
}

function hideTooltip() {
    chartTooltip().style('opacity', 0);
}

async function renderMarketSharePie(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.market_share) return;

    // Donut chart: center shows total; slices show subscriber share
    const width = 420, height = 420, radius = Math.min(width, height) / 2 - 50;
    const innerRadius = radius * 0.55; // Donut hole
    const svg = container.append('svg').attr('width', width).attr('height', height)
        .append('g').attr('transform', `translate(${width/2},${height/2})`);

    const color = d3.scaleOrdinal()
        .domain(data.market_share.map(d => d.carrier))
        .range([ChartColors.verizon, ChartColors.tmobile, ChartColors.att, ChartColors.others]);

    const pie = d3.pie().value(d => d.subscriber_share_pct).sort(null);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius).cornerRadius(4);
    const arcLabel = d3.arc().innerRadius(radius * 0.75).outerRadius(radius * 0.75);

    const arcs = svg.selectAll('arc').data(pie(data.market_share)).join('g');
    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.carrier))
        .attr('stroke', 'rgba(255,255,255,0.4)')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 0.9).attr('stroke-width', 2);
            showTooltip(event, `<strong>${d.data.carrier}</strong><br>Subscriber share: ${d.data.subscriber_share_pct}%<br>Revenue share: ${d.data.revenue_share_pct}%<br><em>${d.data.insight}</em>`);
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 1).attr('stroke-width', 1.5);
            hideTooltip();
        })
        .transition().duration(600).attrTween('d', function(d) {
            const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return t => arc(i(t));
        });

    arcs.filter(d => (d.endAngle - d.startAngle) > 0.15).append('text')
        .attr('transform', d => `translate(${arcLabel.centroid(d)})`)
        .attr('text-anchor', 'middle').attr('fill', '#fff').attr('font-size', 11).attr('font-weight', 600)
        .text(d => `${d.data.subscriber_share_pct}%`)
        .style('opacity', 0).transition().delay(400).style('opacity', 1);

    // Center label: total subscribers
    const totalSubs = data.market_share.reduce((s, d) => s + d.subscriber_share_pct, 0);
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '-0.3em')
        .attr('fill', '#fff').attr('font-size', 18).attr('font-weight', 700)
        .text('~333M');
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '0.9em')
        .attr('fill', 'rgba(255,255,255,0.85)').attr('font-size', 12)
        .text('Total Subscribers');

    // Legend with insights
    const legend = container.append('div').attr('class', 'chart-legend').style('margin-top', '16px').style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '12px 20px');
    data.market_share.forEach(d => {
        legend.append('div').style('font-size', '12px').style('line-height', '1.4')
            .html(`<span style="display:inline-block;width:14px;height:14px;background:${color(d.carrier)};margin-right:6px;border-radius:3px;vertical-align:middle"></span><strong>${d.carrier}</strong>: ${d.insight}`);
    });
}

async function renderMetrosBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.top10_metros) return;

    // Horizontal grouped bar: metro names on left (no rotation)
    const margin = { top: 20, right: 80, bottom: 40, left: 120 };
    const width = 800 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const metros = data.top10_metros;
    const keys = ['verizon', 'tmobile', 'att', 'others'];
    const colors = { verizon: ChartColors.verizon, tmobile: ChartColors.tmobile, att: ChartColors.att, others: ChartColors.others };
    const labels = { verizon: 'Verizon', tmobile: 'T-Mobile', att: 'AT&T', others: 'Others' };

    const y0 = d3.scaleBand().domain(metros.map(d => d.metro)).range([0, height]).padding(0.25);
    const x1 = d3.scaleBand().domain(keys).range([0, y0.bandwidth()]).padding(0.08);
    const x = d3.scaleLinear().domain([0, d3.max(metros, d => d3.max(keys, k => d[k])) * 1.05]).range([0, width]);

    const g = svg.append('g');
    metros.forEach(metro => {
        const row = g.append('g').attr('transform', `translate(0,${y0(metro.metro)})`);
        keys.forEach(key => {
            const bar = row.append('rect')
                .attr('x', 0).attr('y', x1(key))
                .attr('width', 0).attr('height', x1.bandwidth())
                .attr('fill', colors[key]).attr('rx', 3)
                .style('cursor', 'pointer')
                .on('mouseover', function(event) {
                    d3.select(this).attr('opacity', 0.9);
                    showTooltip(event, `<strong>${metro.metro}</strong> – ${labels[key]}<br>${metro[key].toFixed(1)}M subscribers`);
                })
                .on('mouseout', function() {
                    d3.select(this).attr('opacity', 1);
                    hideTooltip();
                });
            bar.transition().duration(500).delay(y0(metro.metro) / height * 200)
                .attr('width', x(metro[key]));
        });
    });

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => d + 'M'));
    svg.append('g').call(d3.axisLeft(y0).tickSize(0));

    const legend = container.append('div').attr('class', 'chart-legend').style('margin-top', '10px');
    keys.forEach(k => {
        legend.append('span').style('margin-right', '16px').style('font-size', '12px')
            .html(`<span style="display:inline-block;width:12px;height:12px;background:${colors[k]};margin-right:4px;border-radius:2px"></span>${labels[k]}`);
    });
}

async function renderSpectrumBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.spectrum_depth_nationwide) return;

    const margin = { top: 24, right: 30, bottom: 50, left: 55 };
    const width = 720 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const bands = data.spectrum_depth_nationwide;
    const keys = ['tmobile_mhz', 'att_mhz', 'verizon_mhz'];
    const colors = [ChartColors.tmobile, ChartColors.att, ChartColors.verizon];
    const labels = ['T-Mobile', 'AT&T', 'Verizon'];

    const x0 = d3.scaleBand().domain(bands.map(d => d.band)).range([0, width]).padding(0.25);
    const x1 = d3.scaleBand().domain(keys).range([0, x0.bandwidth()]).padding(0.06);
    const y = d3.scaleLinear().domain([0, 420]).range([height, 0]);

    bands.forEach((band, i) => {
        const g = svg.append('g').attr('transform', `translate(${x0(band.band)},0)`);
        keys.forEach((key, j) => {
            const h = height - y(band[key]);
            const rect = g.append('rect')
                .attr('x', x1(key)).attr('y', y(band[key]))
                .attr('width', x1.bandwidth()).attr('height', 0)
                .attr('fill', colors[j]).attr('rx', 3)
                .style('cursor', 'pointer')
                .on('mouseover', function(event) {
                    d3.select(this).attr('opacity', 0.9);
                    showTooltip(event, `<strong>${band.band}</strong> – ${labels[j]}<br>${band[key]} MHz`);
                })
                .on('mouseout', function() {
                    d3.select(this).attr('opacity', 1);
                    hideTooltip();
                });
            rect.transition().duration(400).delay(i * 80)
                .attr('height', h);
        });
    });

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x0));
    svg.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => d + ' MHz'));

    const legend = container.append('div').attr('class', 'chart-legend').style('margin-top', '10px');
    labels.forEach((l, i) => legend.append('span').style('margin-right', '16px').style('font-size', '12px')
        .html(`<span style="display:inline-block;width:12px;height:12px;background:${colors[i]};margin-right:4px;border-radius:2px"></span>${l}`));
}

async function renderRevenueBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.revenue_top10) return;

    // Horizontal bar: state names on left, values on right
    const margin = { top: 20, right: 70, bottom: 30, left: 100 };
    const width = 700 - margin.left - margin.right;
    const height = 380 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const states = data.revenue_top10;
    const y = d3.scaleBand().domain(states.map(d => d.state)).range([0, height]).padding(0.2);
    const x = d3.scaleLinear().domain([0, d3.max(states, d => d.annual_revenue_b) * 1.05]).range([0, width]);

    const bars = svg.selectAll('rect').data(states).join('rect')
        .attr('y', d => y(d.state)).attr('height', y.bandwidth())
        .attr('x', 0).attr('width', 0)
        .attr('fill', ChartColors.neutral[2]).attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('fill', ChartColors.neutral[1]);
            showTooltip(event, `<strong>${d.state}</strong><br>Customers: ${d.customers_m}M<br>Annual revenue: $${d.annual_revenue_b}B`);
        })
        .on('mouseout', function(_, d) {
            d3.select(this).attr('fill', ChartColors.neutral[2]);
            hideTooltip();
        });

    bars.transition().duration(500).delay((d, i) => i * 40)
        .attr('width', d => x(d.annual_revenue_b));

    svg.selectAll('.bar-label').data(states).join('text').attr('class', 'bar-label')
        .attr('x', d => x(d.annual_revenue_b) + 6).attr('y', d => y(d.state) + y.bandwidth() / 2)
        .attr('dy', '0.35em').attr('fill', '#fff').attr('font-size', 11).attr('font-weight', 600)
        .text(d => `$${d.annual_revenue_b}B`)
        .style('opacity', 0).transition().delay(550).style('opacity', 1);

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => '$' + d + 'B'));
    svg.append('g').call(d3.axisLeft(y).tickSize(0));
}

async function renderTopStatesBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();
    if (!data || !data.top10_states) return;

    const margin = { top: 20, right: 60, bottom: 30, left: 100 };
    const width = 700 - margin.left - margin.right;
    const height = 380 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const states = data.top10_states;
    const y = d3.scaleBand().domain(states.map(d => d.state)).range([0, height]).padding(0.2);
    const x = d3.scaleLinear().domain([0, 45]).range([0, width]);

    const bars = svg.selectAll('rect').data(states).join('rect')
        .attr('y', d => y(d.state)).attr('height', y.bandwidth())
        .attr('x', 0).attr('width', 0)
        .attr('fill', ChartColors.neutral[3]).attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('fill', ChartColors.neutral[2]);
            showTooltip(event, `<strong>${d.state}</strong><br>${d.customers_m}M customers<br>Primary: ${d.primary_operator}`);
        })
        .on('mouseout', function() {
            d3.select(this).attr('fill', ChartColors.neutral[3]);
            hideTooltip();
        });

    bars.transition().duration(500).delay((d, i) => i * 40)
        .attr('width', d => x(d.customers_m));

    svg.selectAll('.bar-label').data(states).join('text').attr('class', 'bar-label')
        .attr('x', d => x(d.customers_m) + 6).attr('y', d => y(d.state) + y.bandwidth() / 2)
        .attr('dy', '0.35em').attr('fill', '#fff').attr('font-size', 11).attr('font-weight', 600)
        .text(d => d.customers_m + 'M')
        .style('opacity', 0).transition().delay(550).style('opacity', 1);

    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => d + 'M'));
    svg.append('g').call(d3.axisLeft(y).tickSize(0));
}

// Table input: parse CSV or JSON and render horizontal bar chart
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
    const margin = { top: 20, right: 50, bottom: 30, left: Math.min(150, 12 * Math.max(...rows.map(d => String(d[labelKey]).length))) };
    const width = 600 - margin.left - margin.right;
    const height = Math.min(400, rows.length * 28);
    const svg = d3.select('#table-output-viz').append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const y = d3.scaleBand().domain(rows.map(d => String(d[labelKey]))).range([0, height]).padding(0.2);
    const x = d3.scaleLinear().domain([0, d3.max(rows, d => +d[valueKey] || 0)]).range([0, width]);
    svg.selectAll('rect').data(rows).join('rect')
        .attr('y', d => y(String(d[labelKey]))).attr('height', y.bandwidth())
        .attr('x', 0).attr('width', d => x(+d[valueKey] || 0))
        .attr('fill', '#4292c6').attr('rx', 3);
    svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append('g').call(d3.axisLeft(y).tickSize(0));
    output.insertAdjacentHTML('afterbegin', '<p class="success">Parsed ' + rows.length + ' rows. Label: ' + labelKey + ', Value: ' + valueKey + '</p>');
}

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
