/**
 * Custom maps: Data Centers (state highlighting) and Hub Pairs (city dots)
 */
const INDIA_STATE_NAME_TO_KEY = {
    'Maharashtra': 'Maharashtra', 'Uttar Pradesh': 'Uttar Pradesh', 'Andhra Pradesh': 'Andhra Pradesh',
    'Telangana': 'Telangana', 'Bihar': 'Bihar', 'Jharkhand': 'Jharkhand', 'Madhya Pradesh': 'Madhya Pradesh',
    'Chhattisgarh': 'Chhattisgarh', 'Gujarat': 'Gujarat', 'Karnataka': 'Karnataka', 'Rajasthan': 'Rajasthan',
    'West Bengal': 'West Bengal', 'Tamil Nadu': 'Tamil Nadu', 'Delhi': 'Delhi', 'Kerala': 'Kerala',
    'Odisha': 'Odisha', 'Punjab': 'Punjab', 'Haryana': 'Haryana', 'Assam': 'Assam',
    'Jammu and Kashmir': 'Jammu and Kashmir', 'Jammu & Kashmir': 'Jammu and Kashmir', 'Uttarakhand': 'Uttarakhand', 'Himachal Pradesh': 'Himachal Pradesh',
    'Goa': 'Goa', 'Manipur': 'Manipur', 'Meghalaya': 'Meghalaya', 'Mizoram': 'Mizoram', 'Nagaland': 'Nagaland',
    'Tripura': 'Tripura', 'Arunachal Pradesh': 'Arunachal Pradesh', 'Sikkim': 'Sikkim', 'Chandigarh': 'Chandigarh',
    'Andaman and Nicobar': 'Andaman and Nicobar', 'Ladakh': 'Ladakh', 'Puducherry': 'Puducherry'
};

const STATE_NAME_TO_ISO = {
    'California': 'CA', 'Texas': 'TX', 'Florida': 'FL', 'New York': 'NY', 'Pennsylvania': 'PA',
    'Illinois': 'IL', 'Ohio': 'OH', 'Georgia': 'GA', 'N. Carolina': 'NC', 'North Carolina': 'NC',
    'Michigan': 'MI', 'New Jersey': 'NJ', 'Virginia': 'VA', 'Washington (St)': 'WA', 'Washington': 'WA',
    'Arizona': 'AZ', 'Massachusetts': 'MA', 'Tennessee': 'TN', 'Indiana': 'IN', 'Missouri': 'MO',
    'Washington DC': 'DC', 'Wisconsin': 'WI', 'Colorado': 'CO', 'Minnesota': 'MN', 'S. Carolina': 'SC',
    'South Carolina': 'SC', 'Alabama': 'AL', 'Louisiana': 'LA', 'Kentucky': 'KY', 'Virginia (Res)': 'VA',
    'Oregon': 'OR', 'Oklahoma': 'OK', 'Maryland (Res)': 'MD', 'Maryland': 'MD', 'Connecticut': 'CT',
    'Utah': 'UT', 'Iowa': 'IA', 'Nevada': 'NV', 'Arkansas': 'AR', 'Mississippi': 'MS', 'Kansas': 'KS',
    'New Mexico': 'NM', 'Nebraska': 'NE', 'Idaho': 'ID', 'W. Virginia': 'WV', 'West Virginia': 'WV',
    'Hawaii': 'HI', 'New Hampshire': 'NH', 'Maine': 'ME', 'Montana': 'MT', 'Rhode Island': 'RI',
    'Delaware': 'DE', 'S. Dakota': 'SD', 'South Dakota': 'SD', 'N. Dakota': 'ND', 'North Dakota': 'ND',
    'Alaska': 'AK', 'Vermont': 'VT', 'Wyoming': 'WY'
};

let cityCoords = null;
let dataCenterTiersCache = null;
let hubPairsDefaultCache = null;
window.clearMapCaches = function() {
    cityCoords = null;
    dataCenterTiersCache = null;
    hubPairsDefaultCache = null;
    window.__hubPairsCacheCountry = null;
    window.__dcTiersCacheCountry = null;
    window.__dataCenterTierCityLabels = null;
};

const HUB_PAIRS_COLORS = { dual: '#0284c7', single: '#16a34a', superCore: '#dc2626' };

async function loadHubPairsDefault() {
    const country = window.__country || 'us';
    const cacheKey = (country === 'india' || country === 'india-option-b') ? 'india' : 'us';
    if (hubPairsDefaultCache && window.__hubPairsCacheCountry === cacheKey) return hubPairsDefaultCache;
    try {
        const r = await fetch((country === 'india' || country === 'india-option-b') ? '/api/analytics/india/hub-pairs' : '/api/analytics/hub-pairs');
        const data = await r.json();
        const coords = await ((country === 'india' || country === 'india-option-b') ? loadIndiaCityCoords() : loadCityCoords());
        function resolveCoords(name) {
            if (!name) return null;
            let c = coords[name] || coords[name.replace(/\s*\([^)]*\)\s*$/, '').trim()];
            if (c) return c;
            const parts = String(name).split(/\s*\/\s*/).map(p => p.trim());
            for (const p of parts) {
                c = coords[p] || coords[p.replace(/\s*\([^)]*\)\s*$/, '').trim()];
                if (c) return c;
            }
            return null;
        }
        const result = { dual: [], single: [], superCore: [] };
        ['dual', 'single', 'superCore'].forEach(type => {
            const pairs = data[type]?.pairs || [];
            pairs.forEach(p => {
                const h1 = (p.hub1 || p['Primary Location (Hub 1)'] || '').trim();
                const h2 = (p.hub2 || p['Secondary Location (Hub 2)'] || '').trim();
                const c1 = resolveCoords(h1);
                if (!c1) return;
                const c2 = h2 ? resolveCoords(h2) : null;
                result[type].push({
                    state: p.state,
                    hub1: h1,
                    hub2: h2,
                    c1,
                    c2,
                    type,
                    color: HUB_PAIRS_COLORS[type]
                });
            });
        });
        hubPairsDefaultCache = result;
        window.__hubPairsByType = result;
        window.__hubPairsCacheCountry = cacheKey;
    } catch (e) {
        hubPairsDefaultCache = { dual: [], single: [], superCore: [] };
        window.__hubPairsByType = hubPairsDefaultCache;
    }
    return hubPairsDefaultCache;
}

async function loadIndiaCityCoords() {
    try {
        const r = await fetch('/api/analytics/india/city-coordinates');
        return await r.json();
    } catch (e) {
        return {};
    }
}

async function loadDataCenterTiers() {
    const country = window.__country || 'us';
    const cacheKey = (country === 'india' || country === 'india-option-b') ? 'india' : 'us';
    if (dataCenterTiersCache && window.__dcTiersCacheCountry === cacheKey) return dataCenterTiersCache;
    try {
        const r = await fetch((country === 'india' || country === 'india-option-b') ? '/api/analytics/india/data-center-tiers' : '/api/analytics/data-center-tiers');
        const data = await r.json();
        const toKey = (country === 'india' || country === 'india-option-b') ? (s) => (s.state && INDIA_STATE_NAME_TO_KEY[s.state]) || s.state : (s) => stateNameToIso(s.state);
        const tier1 = new Set((data.tier1?.states || []).map(toKey).filter(Boolean));
        const tier2 = new Set((data.tier2?.states || []).map(toKey).filter(Boolean));
        const tier3 = new Set((data.tier3?.states || []).map(toKey).filter(Boolean));
        const cityLabels = {};
        ['tier1', 'tier2', 'tier3'].forEach(tierKey => {
            (data[tierKey]?.states || []).forEach(s => {
                const key = toKey(s);
                if (!key) return;
                const firstCity = Array.isArray(s.cities) && s.cities.length > 0 ? s.cities[0] : (s.city || '');
                if (!cityLabels[key]) cityLabels[key] = {};
                cityLabels[key][tierKey] = firstCity || s.state || key;
            });
        });
        dataCenterTiersCache = { tier1, tier2, tier3 };
        window.__dataCenterTiers = dataCenterTiersCache;
        window.__dataCenterTierCityLabels = cityLabels;
        window.__dcTiersCacheCountry = cacheKey;
    } catch (e) {
        dataCenterTiersCache = { tier1: new Set(), tier2: new Set(), tier3: new Set() };
        window.__dataCenterTiers = dataCenterTiersCache;
        window.__dataCenterTierCityLabels = {};
    }
    return dataCenterTiersCache;
}

async function loadCityCoords() {
    if (cityCoords) return cityCoords;
    try {
        const r = await fetch('/api/analytics/city-coordinates');
        cityCoords = await r.json();
    } catch (e) {
        cityCoords = {};
    }
    return cityCoords;
}

function parseTableToRows(raw) {
    if (!raw) return null;
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
                headers.forEach((h, j) => { obj[h] = vals[j] || ''; });
                rows.push(obj);
            }
        }
    } catch (e) {
        return null;
    }
    return rows;
}

function stateNameToIso(name) {
    if (!name) return null;
    const n = String(name).trim();
    return STATE_NAME_TO_ISO[n] || STATE_NAME_TO_ISO[n.replace(/\s*\([^)]*\)\s*$/, '')] || null;
}

async function renderDataCentersMap(containerId, raw) {
    const container = d3.select(`#${containerId}`);
    if (container.empty()) return;
    container.selectAll('*').remove();
    const rows = parseTableToRows(raw);
    if (!rows || rows.length === 0) {
        container.append('p').attr('class', 'chart-error').text('Paste table with State/District and Type of DC columns.');
        return;
    }
    const keys = Object.keys(rows[0]);
    const stateCol = keys.find(k => /state|district/i.test(k)) || keys[0];
    const valueCol = keys.find(k => /type|dc|primary/i.test(k)) || keys[1];
    const stateValues = {};
    rows.forEach(r => {
        const iso = stateNameToIso(r[stateCol]);
        if (iso) stateValues[iso] = (r[valueCol] || '').trim() || 'None';
    });
    window.__dataCentersStateValues = stateValues;
    const modeSel = document.getElementById('map-mode-select');
    if (modeSel) modeSel.value = 'data-centers';
    if (window.__mapVisualizer) window.__mapVisualizer.applyMapMode('data-centers');
    else window.__pendingMapMode = 'data-centers';
    container.append('p').attr('class', 'success').text('Data loaded. Switch to Map page to view.');
}

async function renderHubPairMap(containerId, raw) {
    const container = d3.select(`#${containerId}`);
    if (container.empty()) return;
    container.selectAll('*').remove();
    const rows = parseTableToRows(raw);
    if (!rows || rows.length === 0) {
        container.append('p').attr('class', 'chart-error').text('Paste table with State, Primary Location (Hub 1), Secondary Location (Hub 2).');
        return;
    }
    const coords = await loadCityCoords();
    const keys = Object.keys(rows[0]);
    const stateCol = keys.find(k => /state/i.test(k)) || keys[0];
    const hub1Col = keys.find(k => /primary|hub\s*1/i.test(k)) || keys[1];
    const hub2Col = keys.find(k => /secondary|hub\s*2/i.test(k)) || keys[2];
    const pairs = [];
    const colors = ['#dc2626', '#0284c7', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#be185d'];
    function resolveCoords(name) {
        if (!name) return null;
        let c = coords[name] || coords[name.replace(/\s*\([^)]*\)\s*$/, '').trim()];
        if (c) return c;
        const parts = name.split(/\s*\/\s*/).map(p => p.trim());
        for (const p of parts) {
            c = coords[p] || coords[p.replace(/\s*\([^)]*\)\s*$/, '').trim()];
            if (c) return c;
        }
        return null;
    }
    rows.forEach((r, i) => {
        const h1 = (r[hub1Col] || '').trim();
        const h2 = (r[hub2Col] || '').trim();
        if (!h1 || !h2) return;
        const c1 = resolveCoords(h1);
        const c2 = resolveCoords(h2);
        if (c1 && c2) {
            pairs.push({ state: r[stateCol], hub1: h1, hub2: h2, c1: c1, c2: c2, color: colors[i % colors.length] });
        }
    });
    window.__hubPairs = pairs;
    const modeSel = document.getElementById('map-mode-select');
    if (modeSel) modeSel.value = 'hub-pairs';
    if (window.__mapVisualizer) window.__mapVisualizer.applyMapMode('hub-pairs');
    else window.__pendingMapMode = 'hub-pairs';
    container.append('p').attr('class', 'success').text('Data loaded. Switch to Map page to view.');
}
