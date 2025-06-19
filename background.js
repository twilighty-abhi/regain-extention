// Background service worker for website blocking

const DEBUG = false; // set to true for verbose logging

let blockingEnabled = true;
let blockedSites = [];

// Initialize on startup
chrome.runtime.onInstalled.addListener(async () => {
  if (DEBUG) console.log('Meowed! extension installed');
  
  // Set default values
  const result = await chrome.storage.sync.get(['blockingEnabled', 'blockedSites']);
  blockingEnabled = result.blockingEnabled !== false;
  blockedSites = result.blockedSites || [];
  
  if (DEBUG) console.log('Meowed! Initialized with', blockedSites.length, 'blocked sites, blocking enabled:', blockingEnabled);
  
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
        if (DEBUG) console.log('Meowed! Background checking URL:', message.url, 'Blocking enabled:', blockingEnabled, 'Sites count:', blockedSites.length);
        const isBlocked = checkIfBlocked(message.url);
        const result = isBlocked && blockingEnabled;
        if (DEBUG) console.log('Meowed! Check result:', result);
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
      
      // Basic length / sanity check
      if (pattern.length > 256) return false;
      
      // Handle wildcard patterns
      if (pattern.includes('*')) {
        const regexPattern = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        
        try {
          const regex = new RegExp('^' + regexPattern + '$');
          return regex.test(hostname) || regex.test(url.toLowerCase());
        } catch(e) {
          if (DEBUG) console.warn('Invalid regex pattern derived from', pattern);
          return false;
        }
      }
      
      // Handle exact matches
      return hostname === pattern || 
             hostname.endsWith('.' + pattern) ||
             url.toLowerCase().includes(pattern);
    });
  } catch (error) {
    if (DEBUG) console.error('Error checking blocked URL:', error);
    return false;
  }
}

// Since we now rely solely on the content script overlay, we do not need
// dynamic declarativeNetRequest rules.  Keep a no-op stub to satisfy calls.
async function updateBlockingRules() {
  return; // intentionally empty
}

// Content script handles all blocking overlays consistently 