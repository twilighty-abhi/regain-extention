document.addEventListener('DOMContentLoaded', async function() {
  // Elements
  const globalToggle = document.getElementById('globalToggle');
  const notificationsToggle = document.getElementById('notificationsToggle');
  const siteUrl = document.getElementById('siteUrl');
  const addSiteBtn = document.getElementById('addSiteBtn');
  const sitesList = document.getElementById('sitesList');
  const emptySites = document.getElementById('emptySites');
  const totalCount = document.getElementById('totalCount');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const toastContainer = document.getElementById('toastContainer');

  // Data
  let blockedSites = [];
  let settings = {};

  // Presets
  const presets = {
    social: [
      'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com',
      'linkedin.com', 'snapchat.com', 'pinterest.com', 'reddit.com'
    ],
    news: [
      'cnn.com', 'bbc.com', 'reuters.com', 'nytimes.com',
      'washingtonpost.com', 'theguardian.com', 'foxnews.com', 'nbcnews.com'
    ],
    entertainment: [
      'youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com',
      'hulu.com', 'disney.com', 'primevideo.com', 'gamespot.com'
    ]
  };

  // Initialize
  await loadData();
  setupEventListeners();

  // Load data from storage
  async function loadData() {
    try {
      const result = await chrome.storage.sync.get(['blockingEnabled', 'blockedSites', 'settings']);
      
      // Load settings
      settings = result.settings || {};
      globalToggle.checked = result.blockingEnabled !== false;
      notificationsToggle.checked = settings.showNotifications !== false;
      
      // Load sites
      blockedSites = result.blockedSites || [];
      displaySites();
      updateSiteCount();
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Error loading data', 'error');
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    globalToggle.addEventListener('change', saveGlobalToggle);
    notificationsToggle.addEventListener('change', saveNotificationToggle);
    addSiteBtn.addEventListener('click', addSite);
    siteUrl.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') addSite();
    });
    clearAllBtn.addEventListener('click', clearAllSites);
    exportBtn.addEventListener('click', exportSites);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importSites);
    
    // Preset buttons
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', function() {
        const presetType = this.dataset.preset;
        addPreset(presetType);
      });
    });
  }

  // Save global toggle
  async function saveGlobalToggle() {
    try {
      await chrome.storage.sync.set({ blockingEnabled: globalToggle.checked });
      await chrome.runtime.sendMessage({
        action: 'toggleBlocking',
        enabled: globalToggle.checked
      });
      showToast('Settings saved', 'success');
    } catch (error) {
      console.error('Error saving global toggle:', error);
      showToast('Error saving settings', 'error');
    }
  }

  // Save notification toggle
  async function saveNotificationToggle() {
    try {
      settings.showNotifications = notificationsToggle.checked;
      await chrome.storage.sync.set({ settings: settings });
      showToast('Settings saved', 'success');
    } catch (error) {
      console.error('Error saving notification toggle:', error);
      showToast('Error saving settings', 'error');
    }
  }

  // Add site
  async function addSite() {
    const url = siteUrl.value.trim();
    
    if (!url) {
      showToast('Please enter a URL', 'error');
      return;
    }

    if (url.length > 256) {
      showToast('Pattern too long (256 char max)', 'error');
      return;
    }

    const illegal = /[\[\]{}+?]/;
    if (illegal.test(url)) {
      showToast('Wildcard pattern contains unsupported characters', 'error');
      return;
    }

    if (!isValidUrl(url)) {
      showToast('Please enter a valid URL or wildcard pattern', 'error');
      return;
    }

    // Check if already exists
    if (blockedSites.some(site => site.url === url)) {
      showToast('Site already blocked', 'error');
      return;
    }

    try {
      const newSite = {
        url: url,
        enabled: true,
        dateAdded: new Date().toISOString()
      };
      
      blockedSites.push(newSite);
      await saveSites();
      
      siteUrl.value = '';
      displaySites();
      updateSiteCount();
      showToast('Site added successfully', 'success');
    } catch (error) {
      console.error('Error adding site:', error);
      showToast('Error adding site', 'error');
    }
  }

  // Display sites
  function displaySites() {
    if (blockedSites.length === 0) {
      sitesList.style.display = 'none';
      emptySites.style.display = 'block';
      return;
    }

    sitesList.style.display = 'block';
    emptySites.style.display = 'none';
    
    sitesList.innerHTML = blockedSites.map((site, index) => `
      <div class="site-card">
        <div class="site-info">
          <div class="site-url">${escapeHtml(site.url)}</div>
          <div class="site-meta">Added: ${formatDate(site.dateAdded)}</div>
        </div>
        <div class="site-actions">
          <div class="site-toggle">
            <label class="switch">
              <input type="checkbox" ${site.enabled ? 'checked' : ''} 
                     onchange="toggleSite(${index})">
              <span class="slider"></span>
            </label>
          </div>
          <button class="action-btn delete" title="Remove site" 
                  onclick="removeSite(${index})">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Global functions for inline handlers
  window.toggleSite = async function(index) {
    try {
      blockedSites[index].enabled = !blockedSites[index].enabled;
      await saveSites();
      showToast('Site updated', 'success');
    } catch (error) {
      console.error('Error toggling site:', error);
      showToast('Error updating site', 'error');
    }
  };

  window.removeSite = async function(index) {
    if (confirm('Are you sure you want to remove this site?')) {
      try {
        blockedSites.splice(index, 1);
        await saveSites();
        displaySites();
        updateSiteCount();
        showToast('Site removed', 'success');
      } catch (error) {
        console.error('Error removing site:', error);
        showToast('Error removing site', 'error');
      }
    }
  };

  // Update site count
  function updateSiteCount() {
    const count = blockedSites.length;
    totalCount.textContent = `${count} blocked site${count !== 1 ? 's' : ''}`;
  }

  // Clear all sites
  async function clearAllSites() {
    if (confirm('Are you sure you want to remove all blocked sites?')) {
      try {
        blockedSites = [];
        await saveSites();
        displaySites();
        updateSiteCount();
        showToast('All sites cleared', 'success');
      } catch (error) {
        console.error('Error clearing sites:', error);
        showToast('Error clearing sites', 'error');
      }
    }
  }

  // Add preset
  async function addPreset(presetType) {
    if (!presets[presetType]) {
      showToast('Invalid preset', 'error');
      return;
    }

    try {
      let addedCount = 0;
      const sitesToAdd = presets[presetType];
      
      for (const url of sitesToAdd) {
        if (!blockedSites.some(site => site.url === url)) {
          blockedSites.push({
            url: url,
            enabled: true,
            dateAdded: new Date().toISOString()
          });
          addedCount++;
        }
      }
      
      if (addedCount > 0) {
        await saveSites();
        displaySites();
        updateSiteCount();
        showToast(`Added ${addedCount} sites from ${presetType} preset`, 'success');
      } else {
        showToast('All sites from this preset are already blocked', 'error');
      }
    } catch (error) {
      console.error('Error adding preset:', error);
      showToast('Error adding preset', 'error');
    }
  }

  // Export sites
  function exportSites() {
    try {
      const data = {
        blockedSites: blockedSites,
        settings: settings,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `website-blocker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Backup exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting:', error);
      showToast('Error exporting backup', 'error');
    }
  }

  // Import sites
  async function importSites(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.blockedSites || !Array.isArray(data.blockedSites)) {
        throw new Error('Invalid backup file format');
      }
      
      let addedCount = 0;
      for (const site of data.blockedSites) {
        if (site.url && !blockedSites.some(existing => existing.url === site.url)) {
          blockedSites.push({
            url: site.url,
            enabled: site.enabled !== false,
            dateAdded: site.dateAdded || new Date().toISOString()
          });
          addedCount++;
        }
      }
      
      if (addedCount > 0) {
        await saveSites();
        displaySites();
        updateSiteCount();
        showToast(`Imported ${addedCount} sites successfully`, 'success');
      } else {
        showToast('No new sites to import', 'error');
      }
    } catch (error) {
      console.error('Error importing:', error);
      showToast('Error importing backup file', 'error');
    }
    
    // Reset file input
    event.target.value = '';
  }

  // Save sites to storage
  async function saveSites() {
    await chrome.storage.sync.set({ blockedSites: blockedSites });
    await chrome.runtime.sendMessage({
      action: 'updateBlockingRules',
      sites: blockedSites
    });
  }

  // Validate URL
  function isValidUrl(url) {
    if (url.includes('*')) {
      return /^(\*\.)?[\w\-]+(\.[\w\-]+)*(\.\*)?$/.test(url) || 
             /^https?:\/\/(\*\.)?[\w\-]+(\.[\w\-]+)*/.test(url);
    }
    
    try {
      new URL(url.startsWith('http') ? url : 'http://' + url);
      return true;
    } catch {
      return false;
    }
  }

  // Format date
  function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Show toast
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}); 