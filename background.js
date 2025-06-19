// Background service worker for website blocking

const DEBUG = false; // set to true for verbose logging

let blockingEnabled = true;
let blockedSites = [];

// simple in-memory cache for checkBlocked results (URL -> {blocked, ts})
const blockCache = new Map();
const CACHE_TTL_MS = 3000;

// Initialize on startup
chrome.runtime.onInstalled.addListener(async () => {
  if (DEBUG) console.log('Meowed! extension installed');
  
  // Set default values
  const result = await chrome.storage.sync.get(['blockingEnabled', 'blockedSites']);
  blockingEnabled = result.blockingEnabled !== false;
  blockedSites = sanitizeBlockedSites(result.blockedSites);
  
  if (DEBUG) console.log('Meowed! Initialized with', blockedSites.length, 'blocked sites, blocking enabled:', blockingEnabled);
  
  await updateBlockingRules();
});

// Also initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Meowed! extension starting up');
  
  // Reload settings
  const result = await chrome.storage.sync.get(['blockingEnabled', 'blockedSites']);
  blockingEnabled = result.blockingEnabled !== false;
  blockedSites = sanitizeBlockedSites(result.blockedSites);
  
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
      blockedSites = sanitizeBlockedSites(changes.blockedSites.newValue);
      await updateBlockingRules();
    }
  }
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  // Reject messages not coming from our own extension context
  if (sender.id && sender.id !== chrome.runtime.id) {
    if (DEBUG) console.warn('Meowed! Rejected message from unknown sender', sender.id);
    return false;
  }
  switch (message.action) {
    case 'toggleBlocking':
      blockingEnabled = message.enabled;
      await updateBlockingRules();
      sendResponse({ success: true });
      break;
      
    case 'updateBlockingRules':
      blockedSites = sanitizeBlockedSites(message.sites);
      await updateBlockingRules();
      sendResponse({ success: true });
      break;
      
    case 'checkBlocked':
      try {
        if (DEBUG) console.log('Meowed! Background checking URL:', message.url, 'Blocking enabled:', blockingEnabled, 'Sites count:', blockedSites.length);
        const urlToCheck = message.url;
        const cached = blockCache.get(urlToCheck);
        const now = Date.now();
        if (cached && (now - cached.ts) < CACHE_TTL_MS) {
          if (DEBUG) console.log('Meowed! Cache hit for', urlToCheck);
          sendResponse({ blocked: cached.blocked });
          break;
        }

        const isBlocked = checkIfBlocked(urlToCheck);
        const result = isBlocked && blockingEnabled;
        blockCache.set(urlToCheck, { blocked: result, ts: now });
        if (blockCache.size > 1000) {
          // rudimentary eviction to keep memory in check
          blockCache.clear();
        }
        if (DEBUG) console.log('Meowed! Cache miss result:', result);
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

// --- helper to enforce length limits and pattern sanity ---
function sanitizeBlockedSites(rawList) {
  if (!Array.isArray(rawList)) return [];
  const cleaned = [];
  for (const item of rawList) {
    if (cleaned.length >= 500) break; // cap list size
    if (!item || typeof item.url !== 'string') continue;
    const url = item.url.trim();
    if (!url || url.length > 256) continue; // skip over-long patterns
    cleaned.push({ url, enabled: item.enabled !== false });
  }
  return cleaned;
}

// Content script handles all blocking overlays consistently 