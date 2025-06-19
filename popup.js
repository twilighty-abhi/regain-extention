document.addEventListener('DOMContentLoaded', async function() {
  const blockingToggle = document.getElementById('blockingToggle');
  const blockedSitesList = document.getElementById('blockedSitesList');
  const emptySites = document.getElementById('emptySites');
  const siteCount = document.getElementById('siteCount');
  const quickAddInput = document.getElementById('quickAddInput');
  const quickAddBtn = document.getElementById('quickAddBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const blockCurrentSiteBtn = document.getElementById('blockCurrentSiteBtn');
  const currentSiteUrl = document.getElementById('currentSiteUrl');

  // Load initial data
  await loadData();
  await loadCurrentSite();

  // Event listeners
  blockingToggle.addEventListener('change', toggleBlocking);
  quickAddBtn.addEventListener('click', quickAddSite);
  quickAddInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      quickAddSite();
    }
  });
  settingsBtn.addEventListener('click', openOptions);
  openOptionsBtn.addEventListener('click', openOptions);
  blockCurrentSiteBtn.addEventListener('click', blockCurrentSite);
  
  // Event delegation for dynamic site list buttons
  blockedSitesList.addEventListener('click', handleSiteAction);

  // Load blocking state and sites
  async function loadData() {
    try {
      const result = await chrome.storage.sync.get(['blockingEnabled', 'blockedSites']);
      
      // Set toggle state
      blockingToggle.checked = result.blockingEnabled !== false; // Default to true
      
      // Load blocked sites
      const sites = result.blockedSites || [];
      displaySites(sites);
      updateSiteCount(sites.length);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Load current site information
  async function loadCurrentSite() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCurrentTab' });
      
      // Check for error in response
      if (response && response.error) {
        console.error('Background script error:', response.error);
        currentSiteUrl.textContent = 'Cannot access current tab';
        blockCurrentSiteBtn.disabled = true;
        return;
      }
      
      if (response && response.tab && response.tab.url) {
        const url = new URL(response.tab.url);
        const hostname = url.hostname;
        
        // Don't show for extension pages or special URLs
        if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
            url.protocol === 'edge:' || url.protocol === 'moz-extension:' ||
            url.protocol === 'about:' || url.protocol === 'file:') {
          currentSiteUrl.textContent = 'Cannot block this page';
          blockCurrentSiteBtn.disabled = true;
          return;
        }
        
        currentSiteUrl.textContent = hostname;
        
        // Check if already blocked
        const result = await chrome.storage.sync.get(['blockedSites']);
        const sites = result.blockedSites || [];
        const isBlocked = sites.some(site => site.url === hostname);
        
        if (isBlocked) {
          blockCurrentSiteBtn.textContent = '✓ Already Blocked';
          blockCurrentSiteBtn.disabled = true;
        } else {
          blockCurrentSiteBtn.innerHTML = '<span class="material-icons">block</span>Block This Site';
          blockCurrentSiteBtn.disabled = false;
        }
      } else {
        // Fallback: try to use chrome.tabs directly
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.url) {
            const url = new URL(tab.url);
            const hostname = url.hostname;
            
            if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
                url.protocol === 'edge:' || url.protocol === 'moz-extension:' ||
                url.protocol === 'about:' || url.protocol === 'file:') {
              currentSiteUrl.textContent = 'Cannot block this page';
              blockCurrentSiteBtn.disabled = true;
              return;
            }
            
            currentSiteUrl.textContent = hostname;
            
            // Check if already blocked
            const result = await chrome.storage.sync.get(['blockedSites']);
            const sites = result.blockedSites || [];
            const isBlocked = sites.some(site => site.url === hostname);
            
            if (isBlocked) {
              blockCurrentSiteBtn.textContent = '✓ Already Blocked';
              blockCurrentSiteBtn.disabled = true;
            } else {
              blockCurrentSiteBtn.innerHTML = '<span class="material-icons">block</span>Block This Site';
              blockCurrentSiteBtn.disabled = false;
            }
          } else {
            currentSiteUrl.textContent = 'No active tab found';
            blockCurrentSiteBtn.disabled = true;
          }
        } catch (tabError) {
          console.error('Error accessing tabs directly:', tabError);
          currentSiteUrl.textContent = 'Cannot access current tab';
          blockCurrentSiteBtn.disabled = true;
        }
      }
    } catch (error) {
      console.error('Error loading current site:', error);
      currentSiteUrl.textContent = 'Error loading site';
      blockCurrentSiteBtn.disabled = true;
    }
  }

  // Toggle blocking on/off
  async function toggleBlocking() {
    const enabled = blockingToggle.checked;
    
    try {
      await chrome.storage.sync.set({ blockingEnabled: enabled });
      
      // Send message to background script
      await chrome.runtime.sendMessage({
        action: 'toggleBlocking',
        enabled: enabled
      });
      
      // Update visual state
      updateToggleState(enabled);
    } catch (error) {
      console.error('Error toggling blocking:', error);
      // Revert toggle if error
      blockingToggle.checked = !enabled;
    }
  }

  // Update visual state based on blocking status
  function updateToggleState(enabled) {
    document.body.classList.toggle('blocking-disabled', !enabled);
  }

  // Display blocked sites
  function displaySites(sites) {
    if (sites.length === 0) {
      blockedSitesList.style.display = 'none';
      emptySites.style.display = 'block';
      return;
    }

    blockedSitesList.style.display = 'block';
    emptySites.style.display = 'none';
    
    blockedSitesList.innerHTML = sites.map((site, index) => `
      <div class="site-item" data-url="${escapeHtml(site.url)}" data-index="${index}">
        <div class="site-info">
          <span class="site-url" title="${escapeHtml(site.url)}">${escapeHtml(site.url)}</span>
        </div>
        <div class="site-actions">
          <label class="switch site-toggle" title="Enable/disable blocking for this site">
            <input type="checkbox" ${site.enabled ? 'checked' : ''} data-action="toggle">
            <span class="slider"></span>
          </label>
          <button class="action-btn delete" title="Remove site" data-action="delete">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Update site count
  function updateSiteCount(count) {
    siteCount.textContent = `${count} site${count !== 1 ? 's' : ''}`;
  }

  // Quick add site
  async function quickAddSite() {
    const url = quickAddInput.value.trim();
    
    if (!url) {
      showError('Please enter a URL');
      return;
    }

    if (!isValidUrl(url)) {
      showError('Please enter a valid URL or wildcard pattern');
      return;
    }

    try {
      const result = await chrome.storage.sync.get(['blockedSites']);
      const sites = result.blockedSites || [];
      
      // Check if site already exists
      if (sites.some(site => site.url === url)) {
        showError('Site already blocked');
        return;
      }

      // Add new site
      const newSite = {
        url: url,
        enabled: true,
        dateAdded: new Date().toISOString()
      };
      
      sites.push(newSite);
      
      await chrome.storage.sync.set({ blockedSites: sites });
      
      // Update blocking rules
      await chrome.runtime.sendMessage({
        action: 'updateBlockingRules',
        sites: sites
      });
      
      // Refresh display
      displaySites(sites);
      updateSiteCount(sites.length);
      
      // Clear input
      quickAddInput.value = '';
      
      // Refresh current site status
      await loadCurrentSite();
      
      showSuccess('Site added successfully');
    } catch (error) {
      console.error('Error adding site:', error);
      showError('Failed to add site');
    }
  }

  // Handle site actions (toggle, delete)
  async function handleSiteAction(event) {
    // Find the element with data-action, checking target and its parents
    let actionElement = event.target;
    let action = actionElement.dataset.action;
    
    // If the target doesn't have action, check parent elements
    if (!action) {
      actionElement = event.target.closest('[data-action]');
      action = actionElement ? actionElement.dataset.action : null;
    }
    
    if (!action) return;
    
    const siteItem = event.target.closest('.site-item');
    if (!siteItem) return;
    
    const url = siteItem.dataset.url;
    const index = parseInt(siteItem.dataset.index);
    
    try {
      const result = await chrome.storage.sync.get(['blockedSites']);
      const sites = result.blockedSites || [];
      
      if (action === 'toggle') {
        // Toggle site enabled/disabled
        if (sites[index]) {
          // Make sure we get the checkbox element
          const checkbox = actionElement.type === 'checkbox' ? actionElement : actionElement.querySelector('input[type="checkbox"]');
          sites[index].enabled = checkbox ? checkbox.checked : !sites[index].enabled;
          await chrome.storage.sync.set({ blockedSites: sites });
          
          await chrome.runtime.sendMessage({
            action: 'updateBlockingRules',
            sites: sites
          });
          
          showSuccess(`Site ${sites[index].enabled ? 'enabled' : 'disabled'}`);
        }
      } else if (action === 'delete') {
        // Remove site
        const updatedSites = sites.filter(site => site.url !== url);
        await chrome.storage.sync.set({ blockedSites: updatedSites });
        
        await chrome.runtime.sendMessage({
          action: 'updateBlockingRules',
          sites: updatedSites
        });
        
        displaySites(updatedSites);
        updateSiteCount(updatedSites.length);
        showSuccess('Site removed successfully');
        
        // Refresh current site status
        await loadCurrentSite();
      }
    } catch (error) {
      console.error('Error handling site action:', error);
      showError('Failed to update site');
    }
  }

  // Block current site
  async function blockCurrentSite() {
    try {
      let hostname = null;
      
      // Try to get current tab via background script first
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getCurrentTab' });
        if (response && response.tab && response.tab.url) {
          const url = new URL(response.tab.url);
          hostname = url.hostname;
        }
      } catch (msgError) {
        console.log('Background script unavailable, trying direct tabs access');
      }
      
      // Fallback to direct tabs access
      if (!hostname) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
          const url = new URL(tab.url);
          hostname = url.hostname;
        }
      }
      
      if (!hostname) {
        showError('Cannot access current tab');
        return;
      }
      
      const result = await chrome.storage.sync.get(['blockedSites']);
      const sites = result.blockedSites || [];
      
      // Check if already exists
      if (sites.some(site => site.url === hostname)) {
        showError('Site already blocked');
        return;
      }
      
      // Add new site
      const newSite = {
        url: hostname,
        enabled: true,
        dateAdded: new Date().toISOString()
      };
      
      sites.push(newSite);
      await chrome.storage.sync.set({ blockedSites: sites });
      
      await chrome.runtime.sendMessage({
        action: 'updateBlockingRules',
        sites: sites
      });
      
      // Refresh displays
      displaySites(sites);
      updateSiteCount(sites.length);
      await loadCurrentSite();
      
      showSuccess('Site blocked successfully');
    } catch (error) {
      console.error('Error blocking current site:', error);
      showError('Failed to block site');
    }
  }



  // Open options page
  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  // Validate URL
  function isValidUrl(url) {
    // Allow wildcard patterns
    if (url.includes('*')) {
      return /^(\*\.)?[\w\-]+(\.[\w\-]+)*(\.\*)?$/.test(url) || 
             /^https?:\/\/(\*\.)?[\w\-]+(\.[\w\-]+)*/.test(url);
    }
    
    // Regular URL validation
    try {
      new URL(url.startsWith('http') ? url : 'http://' + url);
      return true;
    } catch {
      return false;
    }
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Show error message
  function showError(message) {
    showToast(message, 'error');
  }

  // Show success message
  function showSuccess(message) {
    showToast(message, 'success');
  }

  // Show toast notification
  function showToast(message, type) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add toast styles
    toast.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#d32f2f' : '#388e3c'};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Add CSS animations for toasts
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(-50%) translateY(0); opacity: 1; }
      to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    }
    .blocking-disabled .sites-list,
    .blocking-disabled .quick-add {
      opacity: 0.5;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}); 