/**
 * MapVisual Chart Components
 * Modern D3 visualizations following 2024 best practices:
 * - Donut for market share (center metric, easier comparison)
 * - Horizontal bars for long labels (metros, states)
 * - Tooltips, animations, rounded corners
 * - Colorblind-friendly palettes where applicable
 */

const ChartColors = {
    verizon: '#dc2626',
    tmobile: '#db2777',
    att: '#0284c7',
    others: '#64748b',
    neutral: ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],
    // Lighter sequential for density (light theme)
    sequential: ['#e0f2fe', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1']
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
    const isLight = document.body.classList.contains('theme-light');
    tip.html(html).style('opacity', 1)
        .style('background', isLight ? 'rgba(30,41,59,0.95)' : 'rgba(0,0,0,0.9)')
        .style('color', '#fff')
        .style('font-size', '13px')
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 8) + 'px');
}

function hideTooltip() {
    chartTooltip().style('opacity', 0);
}

function ensureContainerVisible(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return false;
    const parent = el.closest('.tab-content');
    return !parent || parent.classList.contains('active');
}

async function renderMarketSharePie(containerId, data) {
    const container = d3.select(`#${containerId}`);
    if (container.empty()) return;
    container.selectAll('*').remove();
    if (!data || !data.market_share || !Array.isArray(data.market_share) || data.market_share.length === 0) {
        container.append('p').attr('class', 'chart-error').text('No market share data available.');
        return;
    }
    if (!ensureContainerVisible(containerId)) return;

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

    const isLight = document.body.classList.contains('theme-light');
    const labelFill = isLight ? '#1e293b' : '#fff';
    arcs.filter(d => (d.endAngle - d.startAngle) > 0.15).append('text')
        .attr('transform', d => `translate(${arcLabel.centroid(d)})`)
        .attr('text-anchor', 'middle').attr('fill', labelFill).attr('font-size', 13).attr('font-weight', 700)
        .text(d => `${d.data.subscriber_share_pct}%`)
        .style('opacity', 0).transition().delay(400).style('opacity', 1);

    // Center label: total subscribers (data-first: prominent values)
    const totalSubs = data.market_share.reduce((s, d) => s + d.subscriber_share_pct, 0);
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '-0.3em')
        .attr('fill', labelFill).attr('font-size', 22).attr('font-weight', 700)
        .text('~333M');
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '0.9em')
        .attr('fill', isLight ? '#64748b' : 'rgba(255,255,255,0.85)').attr('font-size', 13)
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
    if (container.empty()) return;
    container.selectAll('*').remove();
    if (!data || !data.top10_metros || !Array.isArray(data.top10_metros) || data.top10_metros.length === 0) {
        container.append('p').attr('class', 'chart-error').text('No metro data available.');
        return;
    }
    if (!ensureContainerVisible(containerId)) return;

    // Single stacked bar per metro: multicolor segments for each carrier
    const margin = { top: 20, right: 80, bottom: 40, left: 120 };
    const width = 800 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const metros = data.top10_metros;
    const keys = ['verizon', 'tmobile', 'att', 'others'];
    const colors = { verizon: ChartColors.verizon, tmobile: ChartColors.tmobile, att: ChartColors.att, others: ChartColors.others };
    const labels = { verizon: 'Verizon', tmobile: 'T-Mobile', att: 'AT&T', others: 'Others (carriers)' };

    const maxTotal = d3.max(metros, d => d.total) * 1.05;
    const x = d3.scaleLinear().domain([0, maxTotal]).range([0, width]);
    const y = d3.scaleBand().domain(metros.map(d => d.metro)).range([0, height]).padding(0.5);

    const stack = d3.stack().keys(keys).order(d3.stackOrderNone);
    const stacked = stack(metros);

    stacked.forEach((layer, i) => {
        const key = keys[i];
        svg.selectAll(`rect.${key}`).data(layer).join('rect')
            .attr('class', key)
            .attr('y', d => y(d.data.metro))
            .attr('height', y.bandwidth())
            .attr('x', d => x(d[0]))
            .attr('width', 0)
            .attr('fill', colors[key]).attr('rx', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 0.9);
                showTooltip(event, `<strong>${d.data.metro}</strong> – ${labels[key]}<br>${d.data[key].toFixed(1)}M subscribers`);
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 1);
                hideTooltip();
            })
            .transition().duration(400).delay((d, j) => j * 30)
            .attr('width', d => x(d[1]) - x(d[0]));
    });

    const isLight = document.body.classList.contains('theme-light');
    const labelFill = isLight ? '#1e293b' : '#fff';
    stacked.forEach((layer, i) => {
        const key = keys[i];
        svg.selectAll(`text.metro-${key}`).data(layer.filter(d => (d[1] - d[0]) > 1.5)).join('text')
            .attr('class', `metro-${key}`)
            .attr('x', d => x(d[0]) + (x(d[1]) - x(d[0])) / 2)
            .attr('y', d => y(d.data.metro) + y.bandwidth() / 2)
            .attr('dy', '0.35em').attr('text-anchor', 'middle')
            .attr('fill', labelFill).attr('font-size', 10).attr('font-weight', 600)
            .text(d => d.data[key] >= 0.5 ? d.data[key].toFixed(1) : '')
            .style('opacity', 0).transition().delay(500).style('opacity', 1);
    });

    svg.append('g').attr('transform', `translate(0,${height})`).attr('font-size', 13).call(d3.axisBottom(x).ticks(5).tickFormat(d => d + 'M'));
    svg.append('g').attr('font-size', 13).call(d3.axisLeft(y).tickSize(0));

    const legend = container.append('div').attr('class', 'chart-legend').style('margin-top', '12px').style('font-size', '13px');
    keys.forEach(k => {
        legend.append('span').style('margin-right', '16px').style('font-size', '12px')
            .html(`<span style="display:inline-block;width:12px;height:12px;background:${colors[k]};margin-right:4px;border-radius:2px"></span>${labels[k]}`);
    });
}

async function renderSpectrumBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    if (container.empty()) return;
    container.selectAll('*').remove();
    if (!data || !data.spectrum_depth_nationwide || !Array.isArray(data.spectrum_depth_nationwide) || data.spectrum_depth_nationwide.length === 0) {
        container.append('p').attr('class', 'chart-error').text('No spectrum data available.');
        return;
    }
    if (!ensureContainerVisible(containerId)) return;

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
            g.append('text').attr('class', 'spectrum-value')
                .attr('x', x1(key) + x1.bandwidth() / 2).attr('y', y(band[key]) - 4)
                .attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', 600)
                .attr('fill', document.body.classList.contains('theme-light') ? '#1e293b' : '#fff')
                .text(band[key])
                .style('opacity', 0).transition().delay(450 + i * 80).style('opacity', 1);
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
    if (container.empty()) return;
    container.selectAll('*').remove();
    if (!data || !data.revenue_top10 || !Array.isArray(data.revenue_top10) || data.revenue_top10.length === 0) {
        container.append('p').attr('class', 'chart-error').text('No revenue data available.');
        return;
    }
    if (!ensureContainerVisible(containerId)) return;

    const states = data.revenue_top10;
    const count = states.length;
    const subtitleEl = document.getElementById('revenue-subtitle');
    if (subtitleEl) subtitleEl.textContent = count < 51 ? `(Top ${count} States)` : '(All States)';

    // Horizontal bar: state names on left, values on right
    const margin = { top: 20, right: 70, bottom: 30, left: 100 };
    const width = 700 - margin.left - margin.right;
    const height = 380 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);
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

    const isLight = document.body.classList.contains('theme-light');
    const barLabelFill = isLight ? '#1e293b' : '#fff';
    svg.selectAll('.bar-label').data(states).join('text').attr('class', 'bar-label')
        .attr('x', d => x(d.annual_revenue_b) + 6).attr('y', d => y(d.state) + y.bandwidth() / 2)
        .attr('dy', '0.35em').attr('fill', barLabelFill).attr('font-size', 13).attr('font-weight', 700)
        .text(d => `$${d.annual_revenue_b}B`)
        .style('opacity', 0).transition().delay(550).style('opacity', 1);

    svg.append('g').attr('transform', `translate(0,${height})`).attr('font-size', 13).call(d3.axisBottom(x).ticks(5).tickFormat(d => '$' + d + 'B'));
    svg.append('g').attr('font-size', 13).call(d3.axisLeft(y).tickSize(0));
}

async function renderTopStatesBar(containerId, data, operatorKey) {
    const container = d3.select(`#${containerId}`);
    if (container.empty()) return;
    container.selectAll('*').remove();
    if (!data || !data.top10_states || !Array.isArray(data.top10_states) || data.top10_states.length === 0) {
        container.append('p').attr('class', 'chart-error').text('No top states data available.');
        return;
    }
    if (!ensureContainerVisible(containerId)) return;

    const margin = { top: 20, right: 60, bottom: 30, left: 100 };
    const width = 700 - margin.left - margin.right;
    const height = 380 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    let states;
    const valueKey = operatorKey === 'total' ? 'customers_m' : (operatorKey + '_total');
    const valueLabel = operatorKey === 'total' ? 'customers' : operatorKey;

    if (operatorKey === 'total') {
        states = data.top10_states;
    } else {
        const mobileRes = await fetch('/api/mobile/data').then(r => r.json());
        const mobileData = mobileRes.by_state;
        if (!mobileData) return;
        const sorted = mobileData
            .filter(d => d.state_iso !== 'OTH')
            .map(d => ({ state: d.state_name, customers_m: d[valueKey], primary_operator: d.state_name }))
            .sort((a, b) => b.customers_m - a.customers_m)
            .slice(0, 10);
        states = sorted;
    }

    const maxVal = d3.max(states, d => d.customers_m) * 1.05;
    const y = d3.scaleBand().domain(states.map(d => d.state)).range([0, height]).padding(0.2);
    const x = d3.scaleLinear().domain([0, maxVal]).range([0, width]);

    const opColors = { verizon: ChartColors.verizon, tmobile: ChartColors.tmobile, att: ChartColors.att, others: ChartColors.others };
    const barColor = operatorKey === 'total' ? ChartColors.neutral[3] : (opColors[operatorKey] || ChartColors.neutral[3]);

    const bars = svg.selectAll('rect').data(states).join('rect')
        .attr('y', d => y(d.state)).attr('height', y.bandwidth())
        .attr('x', 0).attr('width', 0)
        .attr('fill', barColor).attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 0.85);
            showTooltip(event, `<strong>${d.state}</strong><br>${d.customers_m}M ${valueLabel} (${operatorKey === 'total' ? 'total' : operatorKey})`);
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 1);
            hideTooltip();
        });

    bars.transition().duration(500).delay((d, i) => i * 40)
        .attr('width', d => x(d.customers_m));

    const isLight = document.body.classList.contains('theme-light');
    const barLabelFill = isLight ? '#1e293b' : '#fff';
    svg.selectAll('.bar-label').data(states).join('text').attr('class', 'bar-label')
        .attr('x', d => x(d.customers_m) + 6).attr('y', d => y(d.state) + y.bandwidth() / 2)
        .attr('dy', '0.35em').attr('fill', barLabelFill).attr('font-size', 13).attr('font-weight', 700)
        .text(d => d.customers_m + 'M')
        .style('opacity', 0).transition().delay(550).style('opacity', 1);

    svg.append('g').attr('transform', `translate(0,${height})`).attr('font-size', 13).call(d3.axisBottom(x).ticks(5).tickFormat(d => d + 'M'));
    svg.append('g').attr('font-size', 13).call(d3.axisLeft(y).tickSize(0));
}

// Table input: parse CSV or JSON, show full table + optional bar chart
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
                headers.forEach((h, j) => { obj[h] = vals[j] === '' || isNaN(vals[j]) ? vals[j] : parseFloat(vals[j]); });
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
    const labelKey = keys.find(k => typeof rows[0][k] === 'string' || (rows[0][k] !== '' && isNaN(rows[0][k]))) || keys[0];
    const numericKeys = keys.filter(k => k !== labelKey && !isNaN(rows[0][k]));
    const valueKey = numericKeys[0] || keys[1];

    let html = '<p class="success">Parsed ' + rows.length + ' rows, ' + keys.length + ' columns.</p>';
    html += '<div class="table-viz-controls"><label>Label column:</label><select id="table-label-col">';
    keys.forEach(k => html += '<option value="' + k + '"' + (k === labelKey ? ' selected' : '') + '>' + k + '</option>');
    html += '</select><label>Value column:</label><select id="table-value-col">';
    keys.forEach(k => html += '<option value="' + k + '"' + (k === valueKey ? ' selected' : '') + '>' + k + '</option>');
    html += '</select><button id="table-redraw-chart">Redraw Chart</button></div>';

    html += '<div class="table-data-scroll"><table class="parsed-data-table"><thead><tr>';
    keys.forEach(k => html += '<th>' + k + '</th>');
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
        html += '<tr>';
        keys.forEach(k => html += '<td>' + (row[k] !== undefined && row[k] !== null ? row[k] : '') + '</td>');
        html += '</tr>';
    });
    html += '</tbody></table></div><div id="table-chart-container"></div>';
    output.innerHTML = html;

    function drawChart() {
        const lbl = document.getElementById('table-label-col')?.value || labelKey;
        const val = document.getElementById('table-value-col')?.value || valueKey;
        const container = document.getElementById('table-chart-container');
        if (!container) return;
        container.innerHTML = '';
        const margin = { top: 20, right: 50, bottom: 30, left: Math.min(180, 10 * Math.max(...rows.map(d => String(d[lbl] || '').length))) };
        const width = 600 - margin.left - margin.right;
        const height = Math.min(400, rows.length * 26);
        const svg = d3.select('#table-chart-container').append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
            .append('g').attr('transform', `translate(${margin.left},${margin.top})`);
        const y = d3.scaleBand().domain(rows.map(d => String(d[lbl] || ''))).range([0, height]).padding(0.2);
        const x = d3.scaleLinear().domain([0, d3.max(rows, d => +d[val] || 0) * 1.05]).range([0, width]);
        svg.selectAll('rect').data(rows).join('rect')
            .attr('y', d => y(String(d[lbl] || ''))).attr('height', y.bandwidth())
            .attr('x', 0).attr('width', d => x(+d[val] || 0))
            .attr('fill', '#4292c6').attr('rx', 3);
        svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x));
        svg.append('g').call(d3.axisLeft(y).tickSize(0));
    }
    drawChart();
    document.getElementById('table-redraw-chart')?.addEventListener('click', drawChart);
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
    const operatorKey = (document.getElementById('top-states-operator')?.value || 'total');
    await renderTopStatesBar('chart-top-states', data, operatorKey);
}
