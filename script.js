class WebsiteMonitor {
    constructor() {
        this.websites = [];
        this.isChecking = false;
        this.init();
    }

    init() {
        this.loadWebsites();
        this.bindEvents();
        this.updateStats();
        this.renderWebsites();
    }

    // URL Normalization - Step 1
    normalizeUrl(url) {
        let normalizedUrl = url.trim();
        
        // Remove any existing protocol
        normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '');
        
        // Remove www. prefix if present
        normalizedUrl = normalizedUrl.replace(/^www\./, '');
        
        // Add https:// protocol
        normalizedUrl = `https://${normalizedUrl}`;
        
        return normalizedUrl;
    }

    // Domain Name Extraction - Step 2
    extractDomainName(url) {
        try {
            const urlObj = new URL(url);
            let domain = urlObj.hostname;
            
            // Remove www. prefix if present
            domain = domain.replace(/^www\./, '');
            
            return domain;
        } catch (error) {
            // Fallback: try to extract domain manually
            let domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
            domain = domain.split('/')[0];
            return domain;
        }
    }

    // Status Check Process - Step 3
    async checkWebsiteStatus(website) {
        const startTime = Date.now();
        
        try {
            // Create a promise that rejects after 10 seconds
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), 10000);
            });

            // Make the actual request
            const fetchPromise = fetch(website.url, {
                method: 'HEAD', // Use HEAD for faster response
                mode: 'no-cors', // Handle CORS issues
                cache: 'no-cache'
            });

            // Race between fetch and timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            // Analyze response
            if (response.ok) {
                return {
                    status: 'online',
                    responseTime: responseTime,
                    timestamp: new Date().toISOString(),
                    statusCode: response.status
                };
            } else {
                return {
                    status: 'offline',
                    responseTime: responseTime,
                    timestamp: new Date().toISOString(),
                    statusCode: response.status,
                    error: `HTTP ${response.status}`
                };
            }
        } catch (error) {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            return {
                status: 'offline',
                responseTime: responseTime,
                timestamp: new Date().toISOString(),
                error: error.message || 'Network error'
            };
        }
    }

    // Batch Checking - Step 4
    async checkAllWebsites() {
        if (this.isChecking || this.websites.length === 0) return;
        
        this.isChecking = true;
        this.showLoading(true);
        
        try {
            // Run status checks for all websites simultaneously
            const checkPromises = this.websites.map(async (website) => {
                const result = await this.checkWebsiteStatus(website);
                return { ...website, ...result };
            });
            
            const updatedWebsites = await Promise.all(checkPromises);
            this.websites = updatedWebsites;
            
            this.saveWebsites();
            this.renderWebsites();
            this.updateStats();
            
            // Show success message
            this.showNotification('All websites checked successfully!', 'success');
        } catch (error) {
            console.error('Error checking websites:', error);
            this.showNotification('Error checking websites. Please try again.', 'error');
        } finally {
            this.isChecking = false;
            this.showLoading(false);
        }
    }

    async checkSingleWebsite(websiteId) {
        const website = this.websites.find(w => w.id === websiteId);
        if (!website) return;
        
        // Update website status to checking
        website.status = 'checking';
        this.renderWebsites();
        
        try {
            const result = await this.checkWebsiteStatus(website);
            Object.assign(website, result);
            
            this.saveWebsites();
            this.renderWebsites();
            this.updateStats();
            
            const statusText = result.status === 'online' ? 'is online' : 'is offline';
            this.showNotification(`${website.name} ${statusText}`, 'success');
        } catch (error) {
            console.error('Error checking website:', error);
            website.status = 'unknown';
            this.renderWebsites();
            this.showNotification('Error checking website. Please try again.', 'error');
        }
    }

    addWebsite(url) {
        if (!url.trim()) {
            this.showNotification('Please enter a valid URL', 'error');
            return;
        }
        
        try {
            const normalizedUrl = this.normalizeUrl(url);
            const domainName = this.extractDomainName(normalizedUrl);
            
            // Check if website already exists
            if (this.websites.some(w => w.url === normalizedUrl)) {
                this.showNotification('Website already exists in the list', 'error');
                return;
            }
            
            const website = {
                id: Date.now().toString(),
                url: normalizedUrl,
                name: domainName,
                status: 'unknown',
                responseTime: null,
                timestamp: null,
                error: null
            };
            
            this.websites.push(website);
            this.saveWebsites();
            this.renderWebsites();
            this.updateStats();
            
            // Auto-check the new website
            this.checkSingleWebsite(website.id);
            
            this.showNotification(`${domainName} added successfully!`, 'success');
        } catch (error) {
            console.error('Error adding website:', error);
            this.showNotification('Invalid URL. Please try again.', 'error');
        }
    }

    removeWebsite(websiteId) {
        const website = this.websites.find(w => w.id === websiteId);
        if (website) {
            this.websites = this.websites.filter(w => w.id !== websiteId);
            this.saveWebsites();
            this.renderWebsites();
            this.updateStats();
            this.showNotification(`${website.name} removed from the list`, 'success');
        }
    }

    clearAllWebsites() {
        if (this.websites.length === 0) return;
        
        if (confirm('Are you sure you want to remove all websites?')) {
            this.websites = [];
            this.saveWebsites();
            this.renderWebsites();
            this.updateStats();
            this.showNotification('All websites removed', 'success');
        }
    }

    renderWebsites() {
        const websitesList = document.getElementById('websitesList');
        
        if (this.websites.length === 0) {
            websitesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-globe"></i>
                    <h3>No websites added yet</h3>
                    <p>Add your first website to start monitoring</p>
                </div>
            `;
            return;
        }
        
        websitesList.innerHTML = this.websites.map(website => `
            <div class="website-card ${website.status}">
                <div class="website-info">
                    <div class="website-name">${website.name}</div>
                    <div class="website-url">${website.url}</div>
                    <div class="website-status">
                        <span class="status-indicator ${website.status}"></span>
                        <span>${this.getStatusText(website.status)}</span>
                    </div>
                    <div class="website-details">
                        ${website.timestamp ? `<span>Last checked: ${this.formatTime(website.timestamp)}</span>` : ''}
                        ${website.responseTime ? `<span>Response time: ${website.responseTime}ms</span>` : ''}
                        ${website.statusCode ? `<span>Status: ${website.statusCode}</span>` : ''}
                        ${website.error ? `<span>Error: ${website.error}</span>` : ''}
                    </div>
                </div>
                <div class="website-actions">
                    <button class="btn btn-small btn-secondary" onclick="monitor.checkSingleWebsite('${website.id}')" ${this.isChecking ? 'disabled' : ''}>
                        <i class="fas fa-sync-alt"></i> Check
                    </button>
                    <button class="btn-remove" onclick="monitor.removeWebsite('${website.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        const total = this.websites.length;
        const online = this.websites.filter(w => w.status === 'online').length;
        const offline = this.websites.filter(w => w.status === 'offline').length;
        const unknown = this.websites.filter(w => w.status === 'unknown').length;
        
        document.getElementById('totalSites').textContent = total;
        document.getElementById('onlineSites').textContent = online;
        document.getElementById('offlineSites').textContent = offline;
        document.getElementById('unknownSites').textContent = unknown;
    }

    getStatusText(status) {
        switch (status) {
            case 'online': return 'Online';
            case 'offline': return 'Offline';
            case 'unknown': return 'Unknown';
            case 'checking': return 'Checking...';
            default: return 'Unknown';
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#51cf66' : type === 'error' ? '#ff6b6b' : '#667eea'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    bindEvents() {
        // Add website button
        document.getElementById('addBtn').addEventListener('click', () => {
            const urlInput = document.getElementById('urlInput');
            this.addWebsite(urlInput.value);
            urlInput.value = '';
        });
        
        // Enter key in input
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const urlInput = document.getElementById('urlInput');
                this.addWebsite(urlInput.value);
                urlInput.value = '';
            }
        });
        
        // Check all button
        document.getElementById('checkAllBtn').addEventListener('click', () => {
            this.checkAllWebsites();
        });
        
        // Clear all button
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAllWebsites();
        });
    }

    saveWebsites() {
        localStorage.setItem('ne2ne-websites', JSON.stringify(this.websites));
    }

    loadWebsites() {
        const saved = localStorage.getItem('ne2ne-websites');
        if (saved) {
            try {
                this.websites = JSON.parse(saved);
            } catch (error) {
                console.error('Error loading saved websites:', error);
                this.websites = [];
            }
        }
    }
}

// Initialize the monitor when the page loads
let monitor;
document.addEventListener('DOMContentLoaded', () => {
    monitor = new WebsiteMonitor();
});

// Make monitor globally available for button clicks
window.monitor = monitor; 