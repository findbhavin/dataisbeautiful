/**
 * Fallback visualization for when D3.js libraries are not available
 * Creates a simple table-based view of the data
 */

function createFallbackVisualization() {
    fetch('/api/mobile/data')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('map-svg-container');
            
            // Sort states by total subscribers
            const states = data.by_state
                .filter(s => s.state_iso !== 'OTH')
                .sort((a, b) => b.total_subscribers - a.total_subscribers);
            
            // Create table HTML
            let html = `
                <div style="max-height: 600px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; color: white;">
                        <thead style="position: sticky; top: 0; background: rgba(0,0,0,0.8);">
                            <tr>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid white;">State</th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid white;">Total (M)</th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid white;">Verizon (M)</th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid white;">T-Mobile (M)</th>
                                <th style="padding: 10px; text-align: right; border-bottom: 2px solid white;">AT&T (M)</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            states.forEach((state, index) => {
                const bgColor = index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)';
                html += `
                    <tr style="background: ${bgColor};">
                        <td style="padding: 8px;">${state.state_name} (${state.state_iso})</td>
                        <td style="padding: 8px; text-align: right;">${state.total_subscribers.toFixed(1)}</td>
                        <td style="padding: 8px; text-align: right;">${state.verizon_total.toFixed(1)}</td>
                        <td style="padding: 8px; text-align: right;">${state.tmobile_total.toFixed(1)}</td>
                        <td style="padding: 8px; text-align: right;">${state.att_total.toFixed(1)}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            container.innerHTML = html;
            
            // Update stats
            const totalMillions = states.reduce((sum, s) => sum + s.total_subscribers, 0);
            document.getElementById('stat-total').textContent = totalMillions.toFixed(1) + 'M';
            document.getElementById('stat-states').textContent = states.length;
        })
        .catch(error => {
            console.error('Error loading data:', error);
            document.getElementById('map-svg-container').innerHTML = 
                '<div style="text-align: center; padding: 50px; color: white;"><h2>Error Loading Data</h2></div>';
        });
}
