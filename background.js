// Background service worker for website blocking

let blockingEnabled = true;
let blockedSites = [];

// Initialize on startup
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Meowed! extension installed');
  
  // Set default values
  const result = await chrome.storage.sync.get(['blockingEnabled', 'blockedSites']);
  blockingEnabled = result.blockingEnabled !== false;
  blockedSites = result.blockedSites || [];
  
  console.log('Meowed! Initialized with', blockedSites.length, 'blocked sites, blocking enabled:', blockingEnabled);
  
  await updateBlockingRules();
});

// Also initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Meowed! extension starting up');
  
  // Reload settings
  const result = await chrome.storage.sync.get(['blockingEnabled', 'blockedSites']);
  blockingEnabled = result.blockingEnabled !== false;
  blockedSites = result.blockedSites || [];
  
  console.log('Meowed! Startup with', blockedSites.length, 'blocked sites, blocking enabled:', blockingEnabled);
  
  await updateBlockingRules();
});

// Listen for storage changes
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync') {
    if (changes.blockingEnabled) {
      blockingEnabled = changes.blockingEnabled.newValue;
      await updateBlockingRules();
    }
    if (changes.blockedSites) {
      blockedSites = changes.blockedSites.newValue || [];
      await updateBlockingRules();
    }
  }
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.action) {
    case 'toggleBlocking':
      blockingEnabled = message.enabled;
      await updateBlockingRules();
      sendResponse({ success: true });
      break;
      
    case 'updateBlockingRules':
      blockedSites = message.sites || [];
      await updateBlockingRules();
      sendResponse({ success: true });
      break;
      
    case 'checkBlocked':
      try {
        console.log('Meowed! Background checking URL:', message.url, 'Blocking enabled:', blockingEnabled, 'Sites count:', blockedSites.length);
        const isBlocked = checkIfBlocked(message.url);
        const result = isBlocked && blockingEnabled;
        console.log('Meowed! Check result:', result);
        sendResponse({ blocked: result });
      } catch (error) {
        console.error('Meowed! Error in checkBlocked:', error);
        sendResponse({ blocked: false, error: error.message });
      }
      break;
      
    case 'closeTab':
      if (sender.tab && sender.tab.id) {
        try {
          await chrome.tabs.remove(sender.tab.id);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ error: 'Failed to close tab' });
        }
      } else {
        sendResponse({ error: 'No tab to close' });
      }
      break;
      
    case 'getCurrentTab':
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          sendResponse({ tab: tab });
        } else {
          sendResponse({ error: 'No active tab found' });
        }
      } catch (error) {
        console.error('Error getting current tab:', error);
        sendResponse({ error: 'Failed to get current tab: ' + error.message });
      }
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true; // Indicates async response
});

// Check if URL should be blocked
function checkIfBlocked(url) {
  if (!blockingEnabled || !blockedSites.length) {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return blockedSites.some(site => {
      if (!site.enabled) return false;
      
      const pattern = site.url.toLowerCase();
      
      // Handle wildcard patterns
      if (pattern.includes('*')) {
        const regexPattern = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        
        const regex = new RegExp('^' + regexPattern + '$');
        return regex.test(hostname) || regex.test(url.toLowerCase());
      }
      
      // Handle exact matches
      return hostname === pattern || 
             hostname.endsWith('.' + pattern) ||
             url.toLowerCase().includes(pattern);
    });
  } catch (error) {
    console.error('Error checking blocked URL:', error);
    return false;
  }
}

// Update declarative net request rules
async function updateBlockingRules() {
  try {
    // Clear existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map(rule => rule.id);
    
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }
    
    // Don't add rules if blocking is disabled
    if (!blockingEnabled || !blockedSites.length) {
      return;
    }
    
    // Create new rules
    const rules = [];
    let ruleId = 1;
    
    for (const site of blockedSites) {
      if (!site.enabled) continue;
      
      const pattern = site.url.toLowerCase();
      let urlFilter;
      
      // Convert wildcard patterns to URLFilter format
      if (pattern.includes('*')) {
        // Handle wildcard patterns
        if (pattern.startsWith('*.')) {
          // *.example.com -> *://*.example.com/*
          urlFilter = `*://${pattern}/*`;
        } else if (pattern.endsWith('.*')) {
          // example.* -> *://example.*/*
          urlFilter = `*://${pattern}/*`;
        } else {
          // other patterns
          urlFilter = `*://*${pattern.replace(/\*/g, '')}*`;
        }
      } else {
        // Exact domain matching
        if (pattern.startsWith('http')) {
          urlFilter = `${pattern}*`;
        } else {
          urlFilter = `*://${pattern}/*`;
        }
      }
      
      // Use content script for consistent blurred overlay experience
      // No declarative rules needed - content script will handle everything
    }
    
    // Add rules if any exist
    if (rules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules
      });
    }
    
    console.log(`Updated blocking rules: ${rules.length} rules active`);
  } catch (error) {
    console.error('Error updating blocking rules:', error);
  }
}

// Content script handles all blocking overlays consistently 