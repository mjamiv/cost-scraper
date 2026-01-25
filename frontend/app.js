/**
 * Cost Scraper - Frontend Application
 * Handles Snowflake data querying and display
 */

// ============================================================================
// State
// ============================================================================

let lastQueryResult = null;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Cost Scraper initialized');
    
    // Load saved API URL from localStorage
    const savedUrl = localStorage.getItem('apiUrl');
    if (savedUrl) {
        document.getElementById('api-url').value = savedUrl;
    }
    
    // Save API URL on change
    document.getElementById('api-url').addEventListener('change', (e) => {
        localStorage.setItem('apiUrl', e.target.value);
    });
    
    // Test connection on load
    testConnection();
});

// ============================================================================
// API Helpers
// ============================================================================

function getApiUrl() {
    const input = document.getElementById('api-url');
    return input.value.trim().replace(/\/+$/, ''); // Remove trailing slashes
}

async function apiRequest(endpoint, options = {}) {
    const url = `${getApiUrl()}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return response.json();
}

// ============================================================================
// Connection Testing
// ============================================================================

async function testConnection() {
    const badge = document.getElementById('status-badge');
    const details = document.getElementById('connection-details');
    
    // Set checking state
    badge.className = 'status-badge checking';
    badge.querySelector('.status-text').textContent = 'Checking...';
    details.innerHTML = '<p class="loading">Testing Snowflake connection...</p>';
    
    try {
        const result = await apiRequest('/api/test-connection');
        
        if (result.connected) {
            // Success state
            badge.className = 'status-badge connected';
            badge.querySelector('.status-text').textContent = 'Connected';
            
            details.innerHTML = `
                <div class="detail-row">
                    <span class="detail-label">Account</span>
                    <span class="detail-value">${result.account}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">User</span>
                    <span class="detail-value">${result.user}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Role</span>
                    <span class="detail-value">${result.role}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Warehouse</span>
                    <span class="detail-value">${result.warehouse}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Version</span>
                    <span class="detail-value">${result.version}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Connection Time</span>
                    <span class="detail-value">${result.connection_time_ms}ms</span>
                </div>
            `;
            
            showFeedback(`Connected to Snowflake in ${result.connection_time_ms}ms`, 'success');
        } else {
            throw new Error(result.error || 'Connection failed');
        }
        
    } catch (error) {
        // Error state
        badge.className = 'status-badge disconnected';
        badge.querySelector('.status-text').textContent = 'Disconnected';
        
        details.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        showFeedback(`Connection failed: ${error.message}`, 'error');
    }
}

// ============================================================================
// Query Execution
// ============================================================================

function parseProjectNumbers(text) {
    // Split by newlines, commas, or spaces and clean up
    return text
        .split(/[\n,\s]+/)
        .map(p => p.trim())
        .filter(p => p.length > 0 && /^\d+$/.test(p));
}

async function runQuery() {
    const btn = document.getElementById('run-query');
    const originalText = btn.textContent;
    
    // Get form values
    const projectsText = document.getElementById('project-numbers').value;
    const startMonth = document.getElementById('start-month').value.trim();
    const endMonth = document.getElementById('end-month').value.trim();
    const limit = parseInt(document.getElementById('limit').value) || 5000;
    
    // Parse and validate
    const projectNumbers = parseProjectNumbers(projectsText);
    
    if (projectNumbers.length === 0) {
        showFeedback('Please enter at least one valid project number', 'error');
        return;
    }
    
    if (!/^\d{6}$/.test(startMonth)) {
        showFeedback('Start month must be YYYYMM format (6 digits)', 'error');
        return;
    }
    
    if (endMonth && !/^\d{6}$/.test(endMonth)) {
        showFeedback('End month must be YYYYMM format (6 digits)', 'error');
        return;
    }
    
    // Disable button and show loading
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Querying...';
    showFeedback(`Querying ${projectNumbers.length} projects from ${startMonth}...`, 'loading');
    
    try {
        const requestBody = {
            project_numbers: projectNumbers,
            start_month: startMonth,
            end_month: endMonth || null,
            limit: limit
        };
        
        console.log('Query request:', requestBody);
        
        const result = await apiRequest('/api/query', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
        
        console.log('Query result:', result);
        
        // Store result for CSV download
        lastQueryResult = result;
        
        // Render results
        renderResults(result);
        
        showFeedback(result.message, 'success');
        
    } catch (error) {
        console.error('Query error:', error);
        showFeedback(`Query failed: ${error.message}`, 'error');
        
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// ============================================================================
// Results Rendering
// ============================================================================

function renderResults(result) {
    const card = document.getElementById('results-card');
    const meta = document.getElementById('results-meta');
    const thead = document.getElementById('results-thead');
    const tbody = document.getElementById('results-tbody');
    
    // Show results card
    card.style.display = 'block';
    
    // Update meta
    meta.textContent = `${result.row_count.toLocaleString()} rows • ${result.timing_ms}ms • Query ID: ${result.query_id}`;
    
    // Render header
    thead.innerHTML = `
        <tr>
            ${result.columns.map(col => `<th>${col}</th>`).join('')}
        </tr>
    `;
    
    // Render body
    tbody.innerHTML = result.rows.map(row => `
        <tr>
            ${result.columns.map(col => `<td>${formatCell(row[col])}</td>`).join('')}
        </tr>
    `).join('');
    
    // Scroll to results
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatCell(value) {
    if (value === null || value === undefined) {
        return '<span style="color: var(--text-muted);">—</span>';
    }
    
    // Format numbers with commas
    if (typeof value === 'number') {
        if (Number.isInteger(value)) {
            return value.toLocaleString();
        }
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    return String(value);
}

function clearResults() {
    document.getElementById('results-card').style.display = 'none';
    document.getElementById('results-thead').innerHTML = '';
    document.getElementById('results-tbody').innerHTML = '';
    lastQueryResult = null;
}

// ============================================================================
// CSV Download
// ============================================================================

function downloadCSV() {
    if (!lastQueryResult || !lastQueryResult.rows.length) {
        showFeedback('No data to download', 'error');
        return;
    }
    
    const { columns, rows } = lastQueryResult;
    
    // Build CSV content
    const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (/[",\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    
    const header = columns.map(escapeCSV).join(',');
    const body = rows.map(row => 
        columns.map(col => escapeCSV(row[col])).join(',')
    ).join('\n');
    
    const csv = header + '\n' + body;
    
    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cr_cube_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showFeedback(`Downloaded ${rows.length.toLocaleString()} rows as CSV`, 'success');
}

// ============================================================================
// Feedback Panel
// ============================================================================

let feedbackTimeout = null;

function showFeedback(message, type = 'info') {
    const panel = document.getElementById('feedback-panel');
    const content = document.getElementById('feedback-content');
    
    // Clear existing timeout
    if (feedbackTimeout) {
        clearTimeout(feedbackTimeout);
    }
    
    // Set content and styling
    content.textContent = message;
    panel.className = `card feedback-panel ${type}`;
    panel.style.display = 'block';
    
    // Add loading spinner if needed
    if (type === 'loading') {
        content.innerHTML = `<span class="spinner"></span> ${message}`;
    }
    
    // Auto-hide after delay (except for loading)
    if (type !== 'loading') {
        feedbackTimeout = setTimeout(() => {
            panel.style.display = 'none';
        }, 5000);
    }
}

function hideFeedback() {
    document.getElementById('feedback-panel').style.display = 'none';
}
