/**
 * MapVisual Chart Components
 * Modern D3 visualizations following 2024 best practices:
 * - Donut for market share (center metric, easier comparison)
 * - Horizontal bars for long labels (metros, states)
 * - Tooltips, animations, rounded corners
 * - Colorblind-friendly palettes where applicable
 * - Support for both US and India operators
 */

const ChartColors = {
    // US Operators
    verizon: '#dc2626',
    tmobile: '#db2777',
    att: '#0284c7',
    others: '#64748b',
    // India Operators
    jio: '#0066cc',
    airtel: '#dc2626',
    vi: '#db2777',
    bsnl: '#16a34a',
    neutral: ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],
    // Lighter sequential for density (light theme)
    sequential: ['#e0f2fe', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1']
};

// Get operator color based on operator name
function getOperatorColor(operatorName) {
    const name = (operatorName || '').toLowerCase();
    if (name.includes('jio')) return ChartColors.jio;
    if (name.includes('airtel')) return ChartColors.airtel;
    if (name.includes('vi') || name.includes('vodafone') || name.includes('idea')) return ChartColors.vi;
    if (name.includes('bsnl') || name.includes('mtnl')) return ChartColors.bsnl;
    if (name.includes('verizon')) return ChartColors.verizon;
    if (name.includes('t-mobile') || name.includes('tmobile')) return ChartColors.tmobile;
    if (name.includes('at&t') || name.includes('att')) return ChartColors.att;
    return ChartColors.others;
}

// Helper function to build market share tooltip
function buildMarketShareTooltip(data) {
    const operatorName = data.carrier || data.operator || 'Unknown';
    const sharePct = Number(data.subscriber_share_pct ?? data.share_pct ?? data.subscriberShare ?? 0);
    const revenuePct = Number(data.revenue_share_pct ?? data.revenueShare ?? 0);
    const insight = data.insight || '';
    
    let html = `<strong>${operatorName}</strong><br>Subscriber share: ${sharePct.toFixed(1)}%`;
    if (revenuePct > 0) html += `<br>Revenue share: ${revenuePct.toFixed(1)}%`;
    if (insight) html += `<br><em>${insight}</em>`;
    return html;
}

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

    const isIndia = data.country === 'India' || (window.__country === 'india' || window.__country === 'india-option-b');
    const isLight = document.body.classList.contains('theme-light');
    const chartData = data.market_share.map(d => ({
        operator: d.carrier || d.operator || 'Unknown',
        subscriberShare: Number(d.subscriber_share_pct ?? d.share_pct ?? 0),
        revenueShare: Number(d.revenue_share_pct ?? 0),
        subscribersCr: Number(d.subscribers_cr ?? 0),
        insight: d.insight || ''
    }));

    // Requested sizing: donut area uses ~2:1 width:height.
    const width = Math.max(720, Math.min(940, Math.round(container.node()?.clientWidth || 760)));
    const height = Math.round(width / 2);
    const radius = Math.min(height * 0.39, width * 0.2);
    const innerRadius = radius * 0.56;
    const rawLabelRadius = radius + Math.max(26, radius * 0.2);
    const labelRadius = Math.min(rawLabelRadius, (height / 2) - 16);
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('max-width', '100%')
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    const color = d3.scaleOrdinal()
        .domain(chartData.map(d => d.operator))
        .range(chartData.map(d => getOperatorColor(d.operator)));

    const pie = d3.pie().value(d => d.subscriberShare).sort(null);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius).cornerRadius(4);

    const arcs = svg.selectAll('arc').data(pie(chartData)).join('g');
    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.operator))
        .attr('stroke', 'rgba(255,255,255,0.4)')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 0.9).attr('stroke-width', 2);
            showTooltip(event, buildMarketShareTooltip(d.data));
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 1).attr('stroke-width', 1.5);
            hideTooltip();
        })
        .transition().duration(600).attrTween('d', function(d) {
            const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return t => arc(i(t));
        });

    const labelFill = isLight ? '#1e293b' : '#fff';
    arcs.filter(d => (d.endAngle - d.startAngle) > 0.08).each(function(d) {
        const midAngle = (d.startAngle + d.endAngle) / 2;
        const innerX = Math.sin(midAngle) * radius;
        const innerY = -Math.cos(midAngle) * radius;
        const outerX = Math.sin(midAngle) * labelRadius;
        const outerY = -Math.cos(midAngle) * labelRadius;
        const anchor = outerX > 0 ? 'start' : 'end';
        const textX = outerX > 0 ? outerX + 6 : outerX - 6;
        const g = d3.select(this);
        g.append('line').attr('x1', innerX).attr('y1', innerY).attr('x2', outerX).attr('y2', outerY)
            .attr('stroke', isLight ? '#64748b' : 'rgba(255,255,255,0.5)').attr('stroke-width', 1);
        g.append('text').attr('transform', `translate(${textX},${outerY})`)
            .attr('text-anchor', anchor).attr('dominant-baseline', 'middle')
            .attr('fill', labelFill).attr('font-size', 13).attr('font-weight', 600)
            .text(`${d.data.operator}: ${d.data.subscriberShare.toFixed(1)}%`)
            .style('opacity', 0).transition().delay(400).style('opacity', 1);
    });

    // Center label: total subscribers (data-first: prominent values)
    const totalSubsCr = chartData.reduce((s, d) => s + (d.subscribersCr || 0), 0);
    const centerLabel = isIndia && totalSubsCr > 0 ? `~${totalSubsCr.toFixed(1)} Cr` : '~333M';
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '-0.3em')
        .attr('fill', labelFill).attr('font-size', 22).attr('font-weight', 700)
        .text(centerLabel);
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '0.9em')
        .attr('fill', isLight ? '#64748b' : 'rgba(255,255,255,0.85)').attr('font-size', 13)
        .text('Total Subscribers');

    // Legend with operator insights.
    const legend = container.append('div').attr('class', 'chart-legend').style('margin-top', '14px').style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '10px 24px');
    chartData.forEach(d => {
        legend.append('div').style('font-size', '12px').style('line-height', '1.5')
            .html(`<span style="display:inline-block;width:12px;height:12px;background:${color(d.operator)};margin-right:8px;border-radius:3px;vertical-align:middle"></span><strong>${d.operator}</strong>: ${d.insight}`);
    });

    // Table below donut with percentage caption and relative-size bars.
    const tableWrap = container.append('div').style('margin-top', '16px').style('overflow-x', 'auto');
    const table = tableWrap.append('table')
        .style('width', '100%')
        .style('min-width', '560px')
        .style('border-collapse', 'collapse')
        .style('font-size', '12px')
        .style('border', isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.2)')
        .style('border-radius', '8px')
        .style('overflow', 'hidden');

    table.append('caption')
        .style('caption-side', 'top')
        .style('text-align', 'left')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('padding', '6px 2px 8px')
        .style('color', isLight ? '#334155' : '#e2e8f0')
        .text('Market share table (% share)');

    const headerBg = isLight ? '#f8fafc' : 'rgba(255,255,255,0.08)';
    const rowBorder = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.15)';
    const textColor = isLight ? '#1e293b' : '#e2e8f0';
    const subTextColor = isLight ? '#475569' : '#cbd5e1';

    const thead = table.append('thead').append('tr').style('background', headerBg);
    ['Operator', 'Subscriber % share', 'Revenue % share', 'Relative size'].forEach(h => {
        thead.append('th')
            .style('padding', '8px 10px')
            .style('text-align', 'left')
            .style('border-bottom', `1px solid ${rowBorder}`)
            .style('color', textColor)
            .text(h);
    });

    const rows = table.append('tbody').selectAll('tr').data(chartData).join('tr');
    rows.each(function(d, i) {
        const tr = d3.select(this);
        tr.style('border-bottom', i === chartData.length - 1 ? 'none' : `1px solid ${rowBorder}`);

        tr.append('td').style('padding', '8px 10px').style('color', textColor)
            .html(`<span style="display:inline-block;width:10px;height:10px;background:${color(d.operator)};border-radius:2px;margin-right:6px;vertical-align:middle"></span><strong>${d.operator}</strong>`);

        tr.append('td').style('padding', '8px 10px').style('color', textColor)
            .text(`${d.subscriberShare.toFixed(1)}%`);

        tr.append('td').style('padding', '8px 10px').style('color', textColor)
            .text(d.revenueShare > 0 ? `${d.revenueShare.toFixed(1)}%` : '-');

        const barCell = tr.append('td').style('padding', '8px 10px');
        const barWrapRow = barCell.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '8px');
        barWrapRow.append('div')
            .style('width', `${Math.max(20, Math.round(d.subscriberShare * 2.2))}px`)
            .style('height', '10px')
            .style('border-radius', '999px')
            .style('background', color(d.operator))
            .style('opacity', '0.9');
        barWrapRow.append('span').style('color', subTextColor).text(`${d.subscriberShare.toFixed(1)}%`);
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

    const isIndia = data.country === 'India' || (window.__country === 'india' || window.__country === 'india-option-b');
    let metros = data.top10_metros;
    if (isIndia && metros[0] && !metros[0].jio && metros[0].subscribers_cr != null) {
        const shares = { jio: 0.385, airtel: 0.321, vi: 0.189, bsnl: 0.082, others: 0.023 };
        metros = metros.map(d => {
            const t = d.subscribers_cr || 0;
            return { metro: d.metro, total: t, jio: t * shares.jio, airtel: t * shares.airtel, vi: t * shares.vi, bsnl: t * shares.bsnl, others: t * shares.others };
        });
    }

    const keys = isIndia ? ['jio', 'airtel', 'vi', 'bsnl', 'others'] : ['verizon', 'tmobile', 'att', 'others'];
    const colors = isIndia
        ? { jio: ChartColors.jio, airtel: ChartColors.airtel, vi: ChartColors.vi, bsnl: ChartColors.bsnl, others: ChartColors.others }
        : { verizon: ChartColors.verizon, tmobile: ChartColors.tmobile, att: ChartColors.att, others: ChartColors.others };
    const labels = isIndia
        ? { jio: 'Jio', airtel: 'Airtel', vi: 'Vi', bsnl: 'BSNL', others: 'Others' }
        : { verizon: 'Verizon', tmobile: 'T-Mobile', att: 'AT&T', others: 'Others (carriers)' };

    const margin = { top: 20, right: 80, bottom: 40, left: 120 };
    const width = 800 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxTotal = d3.max(metros, d => d.total || 0) * 1.05;
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
                const unit = isIndia ? ' Cr' : 'M';
                showTooltip(event, `<strong>${d.data.metro}</strong> – ${labels[key]}<br>${d.data[key].toFixed(1)}${unit} subscribers`);
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 1);
                hideTooltip();
            })
            .transition().duration(400).delay((d, j) => j * 30)
            .attr('width', d => x(d[1]) - x(d[0]));
    });

    const minSegment = isIndia ? 0.5 : 1.5;
    stacked.forEach((layer, i) => {
        const key = keys[i];
        svg.selectAll(`text.metro-${key}`).data(layer.filter(d => (d[1] - d[0]) > minSegment)).join('text')
            .attr('class', `metro-${key}`)
            .attr('x', d => x(d[0]) + (x(d[1]) - x(d[0])) / 2)
            .attr('y', d => y(d.data.metro) + y.bandwidth() / 2)
            .attr('dy', '0.35em').attr('text-anchor', 'middle')
            .attr('fill', '#fff').attr('font-size', 10).attr('font-weight', 600)
            .text(d => d.data[key] >= 0.5 ? d.data[key].toFixed(1) : '')
            .style('opacity', 0).transition().delay(500).style('opacity', 1);
    });

    const xAxisFormat = isIndia ? d => d + ' Cr' : d => d + 'M';
    svg.append('g').attr('transform', `translate(0,${height})`).attr('font-size', 13).call(d3.axisBottom(x).ticks(5).tickFormat(xAxisFormat));
    svg.append('g').attr('font-size', 13).call(d3.axisLeft(y).tickSize(0));

    const legend = container.append('div').attr('class', 'chart-legend').style('margin-top', '12px').style('font-size', '13px');
    keys.forEach(k => {
        legend.append('span').style('margin-right', '16px').style('font-size', '12px')
            .html(`<span style="display:inline-block;width:12px;height:12px;background:${colors[k]};margin-right:4px;border-radius:2px"></span>${labels[k]}`);
    });
}

async function renderSpectrumBarIndia(containerId, data) {
    const container = d3.select(`#${containerId}`);
    const bands = data.spectrum_by_state || [];
    const margin = { top: 24, right: 90, bottom: 40, left: 120 };
    const width = 720 - margin.left - margin.right;
    const height = Math.min(400, bands.length * 32);

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand().domain(bands.map(d => d.state)).range([0, height]).padding(0.2);
    const x = d3.scaleLinear().domain([0, d3.max(bands, d => d.spectrum_mhz) * 1.05]).range([0, width]);
    const isLight = document.body.classList.contains('theme-light');
    const labelFill = isLight ? '#1e293b' : '#fff';

    bands.forEach((d, i) => {
        const g = svg.append('g').attr('transform', `translate(0,${y(d.state)})`);
        g.append('rect').attr('x', 0).attr('y', 2).attr('height', y.bandwidth() - 4)
            .attr('width', 0).attr('fill', ChartColors.neutral[2]).attr('rx', 3)
            .style('cursor', 'pointer')
            .on('mouseover', function(event) {
                d3.select(this).attr('opacity', 0.9);
                showTooltip(event, `<strong>${d.state}</strong><br>Spectrum: ${d.spectrum_mhz} MHz<br>Cost: ₹${d.cost_cr} Cr`);
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 1);
                hideTooltip();
            })
            .transition().duration(400).delay(i * 40).attr('width', x(d.spectrum_mhz));
        g.append('text').attr('x', x(d.spectrum_mhz) + 6).attr('y', y.bandwidth() / 2).attr('dy', '0.35em')
            .attr('fill', labelFill).attr('font-size', 11).attr('font-weight', 600)
            .text(d.spectrum_mhz + ' MHz')
            .style('opacity', 0).transition().delay(450 + i * 40).style('opacity', 1);
    });

    svg.append('g').attr('font-size', 12).call(d3.axisLeft(y).tickSize(0));
    svg.append('g').attr('transform', `translate(0,${height})`).attr('font-size', 11).call(d3.axisBottom(x).ticks(5).tickFormat(d => d + ' MHz'));
}

async function renderSpectrumBar(containerId, data) {
    const container = d3.select(`#${containerId}`);
    if (container.empty()) return;
    container.selectAll('*').remove();
    const isIndia = data?.country === 'India' || (window.__country === 'india' || window.__country === 'india-option-b');
    const hasIndiaSpectrum = isIndia && data?.spectrum_by_state && Array.isArray(data.spectrum_by_state) && data.spectrum_by_state.length > 0;
    const hasUSSpectrum = data?.spectrum_depth_nationwide && Array.isArray(data.spectrum_depth_nationwide) && data.spectrum_depth_nationwide.length > 0;
    if (!hasIndiaSpectrum && !hasUSSpectrum) {
        container.append('p').attr('class', 'chart-error').text('No spectrum data available.');
        return;
    }
    if (!ensureContainerVisible(containerId)) return;

    if (hasIndiaSpectrum) {
        return renderSpectrumBarIndia(containerId, data);
    }

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

    const isIndia = data.country === 'India' || (window.__country === 'india' || window.__country === 'india-option-b');
    const states = data.revenue_top10;
    if (states.length > 15) {
        container.style('max-height', '420px').style('overflow-y', 'auto');
    } else {
        container.style('max-height', null).style('overflow-y', null);
    }
    const count = states.length;
    const subtitleEl = document.getElementById('revenue-subtitle');
    if (subtitleEl) subtitleEl.textContent = count > 15 ? '(All States)' : `(Top ${count} States)`;

    const valueKey = isIndia ? 'annual_revenue_b' : 'annual_revenue_b';
    const maxVal = d3.max(states, d => d.annual_revenue_b) * 1.05;

    const margin = { top: 20, right: 90, bottom: 30, left: 100 };
    const width = 700 - margin.left - margin.right;
    const bandHeight = 24;
    const height = Math.min(380 - margin.top - margin.bottom, Math.max(200, count * bandHeight));

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const y = d3.scaleBand().domain(states.map(d => d.state)).range([0, height]).padding(0.2);
    const x = d3.scaleLinear().domain([0, maxVal]).range([0, width]);

    const bars = svg.selectAll('rect').data(states).join('rect')
        .attr('y', d => y(d.state)).attr('height', y.bandwidth())
        .attr('x', 0).attr('width', 0)
        .attr('fill', ChartColors.neutral[2]).attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('fill', ChartColors.neutral[1]);
            const tip = isIndia
                ? `<strong>${d.state}</strong><br>Revenue: ₹${(d.revenue_inr_cr || d.annual_revenue_b * 1000).toLocaleString()} Cr${d.growth_pct != null ? `<br>Growth: ${d.growth_pct}%` : ''}`
                : `<strong>${d.state}</strong><br>Customers: ${d.customers_m}M<br>Annual revenue: $${d.annual_revenue_b}B`;
            showTooltip(event, tip);
        })
        .on('mouseout', function() {
            d3.select(this).attr('fill', ChartColors.neutral[2]);
            hideTooltip();
        });

    bars.transition().duration(500).delay((d, i) => i * 40)
        .attr('width', d => x(d.annual_revenue_b));

    const isLight = document.body.classList.contains('theme-light');
    const barLabelFill = isLight ? '#1e293b' : '#fff';
    const formatLabel = isIndia
        ? d => {
            const v = d.revenue_inr_cr != null ? d.revenue_inr_cr : d.annual_revenue_b * 1000;
            return v >= 1000 ? `₹${Math.round(v / 1000)}K Cr` : `₹${Math.round(v)} Cr`;
        }
        : d => `$${d.annual_revenue_b}B`;
    svg.selectAll('.bar-label').data(states).join('text').attr('class', 'bar-label')
        .attr('x', d => x(d.annual_revenue_b) + 6).attr('y', d => y(d.state) + y.bandwidth() / 2)
        .attr('dy', '0.35em').attr('fill', '#fff').attr('font-size', 12).attr('font-weight', 700)
        .text(formatLabel)
        .style('opacity', 0).transition().delay(550).style('opacity', 1);

    const xAxisFormat = isIndia ? d => `₹${d}K Cr` : d => '$' + d + 'B';
    svg.append('g').attr('transform', `translate(0,${height})`).attr('font-size', 13).call(d3.axisBottom(x).ticks(5).tickFormat(xAxisFormat));
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

    const isIndia = data.country === 'India' || (window.__country === 'india' || window.__country === 'india-option-b');
    const margin = { top: 20, right: 80, bottom: 30, left: 100 };
    const width = 700 - margin.left - margin.right;
    const height = 380 - margin.top - margin.bottom;

    const svg = container.append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    let states;
    const valueKey = operatorKey === 'total' ? 'customers_m' : (operatorKey + '_total');
    const valueLabel = operatorKey === 'total' ? (isIndia ? 'revenue (Cr)' : 'customers') : operatorKey;

    if (operatorKey === 'total' || isIndia) {
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
            const tip = isIndia && d.revenue_inr_cr != null
                ? `<strong>${d.state}</strong><br>Revenue: ₹${(d.revenue_inr_cr / 1000).toFixed(0)}K Cr`
                : `<strong>${d.state}</strong><br>${d.customers_m}M ${valueLabel} (${operatorKey === 'total' ? 'total' : operatorKey})`;
            showTooltip(event, tip);
        })
        .on('mouseout', function() {
            d3.select(this).attr('opacity', 1);
            hideTooltip();
        });

    bars.transition().duration(500).delay((d, i) => i * 40)
        .attr('width', d => x(d.customers_m));

    const isLight = document.body.classList.contains('theme-light');
    const barLabelFill = isLight ? '#1e293b' : '#fff';
    const barLabel = isIndia && states[0]?.revenue_inr_cr != null
        ? d => `₹${Math.round((d.revenue_inr_cr || 0) / 1000)}K Cr`
        : d => d.customers_m + 'M';
    svg.selectAll('.bar-label').data(states).join('text').attr('class', 'bar-label')
        .attr('x', d => x(d.customers_m) + 6).attr('y', d => y(d.state) + y.bandwidth() / 2)
        .attr('dy', '0.35em').attr('fill', barLabelFill).attr('font-size', 13).attr('font-weight', 700)
        .text(barLabel)
        .style('opacity', 0).transition().delay(550).style('opacity', 1);

    const xAxisFormat = isIndia && states[0]?.revenue_inr_cr != null ? d => `₹${d}K Cr` : d => d + 'M';
    svg.append('g').attr('transform', `translate(0,${height})`).attr('font-size', 13).call(d3.axisBottom(x).ticks(5).tickFormat(xAxisFormat));
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
    const isIndia = (window.__country === 'india' || window.__country === 'india-option-b');
    const url = isIndia ? '/api/analytics/india/market-wide' : '/api/analytics/market-wide';
    const data = await fetch(url).then(r => r.json());
    await renderMarketSharePie('chart-market-share', data);
}
async function loadMetros() {
    const isIndia = (window.__country === 'india' || window.__country === 'india-option-b');
    const url = isIndia ? '/api/analytics/india/metros' : '/api/analytics/metros';
    const data = await fetch(url).then(r => r.json());
    const h3 = document.querySelector('#tab-metros h3');
    if (h3) h3.textContent = isIndia ? 'Top 10 Indian Metro Areas by Carrier (Crores)' : 'Top 10 US Metro Areas by Carrier (Millions)';
    await renderMetrosBar('chart-metros', data);
}
async function loadSpectrum() {
    const isIndia = (window.__country === 'india' || window.__country === 'india-option-b');
    const url = isIndia ? '/api/analytics/india/spectrum' : '/api/analytics/spectrum';
    const data = await fetch(url).then(r => r.json());
    const h3 = document.querySelector('#tab-spectrum h3');
    if (h3) h3.textContent = isIndia ? 'Spectrum Holdings by State (India)' : 'Estimated Sub-6 GHz Spectrum Depth by Band (2026)';
    await renderSpectrumBar('chart-spectrum', data);
}
async function loadRevenue() {
    const isIndia = (window.__country === 'india' || window.__country === 'india-option-b');
    const url = isIndia ? '/api/analytics/india/revenue-by-state' : '/api/analytics/revenue-by-state';
    const data = await fetch(url).then(r => r.json());
    const h3 = document.querySelector('#tab-revenue h3');
    if (h3) h3.innerHTML = isIndia ? 'Wireless Revenue by State (INR Cr) <span id="revenue-subtitle" class="chart-subtitle"></span>' : 'Estimated 2025 Annual Wireless Service Revenue by State <span id="revenue-subtitle" class="chart-subtitle"></span>';
    await renderRevenueBar('chart-revenue', data);
}
async function loadTopStates() {
    const isIndia = (window.__country === 'india' || window.__country === 'india-option-b');
    const url = isIndia ? '/api/analytics/india/market-wide' : '/api/analytics/market-wide';
    const data = await fetch(url).then(r => r.json());
    const h3 = document.querySelector('#tab-top-states h3');
    if (h3) h3.textContent = isIndia ? 'Top 10 States by Revenue (INR Cr)' : 'Top 10 States by Customer Base';
    const controlsEl = document.querySelector('#tab-top-states .chart-controls-inline');
    if (controlsEl) controlsEl.style.display = isIndia ? 'none' : '';
    const operatorKey = isIndia ? 'total' : (document.getElementById('top-states-operator')?.value || 'total');
    await renderTopStatesBar('chart-top-states', data, operatorKey);
}
