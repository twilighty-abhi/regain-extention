// Content script for website blocking

(function() {
  'use strict';

  const DEBUG = false;

  let checkTimeout;
  let hasChecked = false;
  
  // Check if current page should be blocked
  async function checkCurrentPage() {
    const currentUrl = window.location.href;
    
    // Skip invalid URLs
    if (!currentUrl || currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://') || currentUrl.startsWith('moz-extension://')) {
      return;
    }
    
    if (DEBUG) console.log('Meowed! checking URL:', currentUrl);
    
    let response;
    try {
      response = await chrome.runtime.sendMessage({
        action: 'checkBlocked',
        url: currentUrl
      });
      
      console.log('Meowed! response:', response);
      
      if (response && response.blocked) {
        console.log('Meowed! blocking URL:', currentUrl);
        showBlockingOverlay(currentUrl);
      }
    } catch(err){
      if (DEBUG) console.warn('Meowed! sendMessage failed:', err?.message);
      return;
    }
  }
  
  // Enhanced check function with multiple triggers
  function performCheck() {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => {
      checkCurrentPage();
    }, 200);
  }
  
  // Fun cat messages for blocking
  const catMessages = [
    "The cats have spoken... and they said no! 🐾",
    "A sneaky cat knocked your internet cable! 🐱",
    "The cat council has voted against this site! 😼",
    "Meow means NO in cat language! 🙀",
    "Your cat overlords disapprove of this choice! 👑",
    "A fluffy paw has blocked your path! 🐾",
    "The cats are protecting you from distractions! 😺",
    "Purr-haps you should do something else? 🐈",
    "The kitty committee says 'nope'! 🐱‍💻",
    "A wild cat appeared and used Block! It's super effective! ⚡",
    "The cats knocked this website off the table! 🐾",
    "Meow-mentum redirected to productivity! 🚀",
    "The feline firewall is purr-tecting you! 🔥",
    "Cat.exe has stopped this website! 💻",
    "The whisker wisdom says 'focus elsewhere'! 📚",
    "A cat is sitting on your keyboard... digitally! ⌨️",
    "The purr patrol has intercepted this request! 👮‍♀️",
    "Your productivity cat is doing its job! 💼",
    "The internet cats are having a meeting about this! 📋",
    "Paws down, this site is blocked! 🐾"
  ];

  // Show blocking overlay
  function showBlockingOverlay(blockedUrl) {
    // Don't show overlay if already exists
    if (document.getElementById('website-blocker-overlay')) {
      return;
    }
    
    // Get random cat message
    const randomMessage = catMessages[Math.floor(Math.random() * catMessages.length)];
    
    // Apply blur via CSS class instead of DOM swapping (CSP-safe & non-destructive)
    if (!document.getElementById('meowed-blur-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'meowed-blur-style';
      styleEl.textContent = `body.meowed-blur > *:not(#website-blocker-overlay){filter:blur(5px)!important;pointer-events:none!important}`;
      document.head.appendChild(styleEl);
    }
    document.body.classList.add('meowed-blur');
    
    // Create overlay with CSP-compliant DOM creation
    const overlay = document.createElement('div');
    overlay.id = 'website-blocker-overlay';
    
    // Create modal structure programmatically to avoid CSP issues
    const modal = document.createElement('div');
    modal.className = 'blocker-modal';
    
    // Close X button
    const closeXBtn = document.createElement('button');
    closeXBtn.id = 'blocker-close-x';
    closeXBtn.className = 'blocker-close-btn';
    closeXBtn.textContent = '✕';
    modal.appendChild(closeXBtn);
    
    // Content container
    const content = document.createElement('div');
    content.className = 'blocker-content';
    
    // Icon center with simple emoji instead of SVG to avoid CSP issues
    const iconCenter = document.createElement('div');
    iconCenter.className = 'blocker-icon-center';
    iconCenter.innerHTML = '🐱';
    iconCenter.style.fontSize = '80px';
    content.appendChild(iconCenter);
    
    // Title
    const title = document.createElement('h1');
    title.textContent = 'Meowed!';
    content.appendChild(title);
    
    // Message
    const message = document.createElement('p');
    message.className = 'blocker-message';
    message.textContent = `This website has been blocked! ${randomMessage}`;
    content.appendChild(message);
    
    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.className = 'blocker-subtitle';
    subtitle.textContent = 'You can manage your blocked sites from the extension popup.';
    content.appendChild(subtitle);
    
    // Blocked URL
    const urlDiv = document.createElement('div');
    urlDiv.className = 'blocked-url';
    urlDiv.textContent = blockedUrl;
    content.appendChild(urlDiv);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'blocker-actions';
    
    const backBtn = document.createElement('button');
    backBtn.id = 'blocker-back';
    backBtn.className = 'btn';
    backBtn.textContent = 'Go Back';
    actions.appendChild(backBtn);
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'blocker-close';
    closeBtn.className = 'btn btn-primary';
    closeBtn.textContent = 'Close Tab';
    actions.appendChild(closeBtn);
    
    content.appendChild(actions);
    
    // Footer
    const footer = document.createElement('div');
    footer.className = 'blocker-footer';
    const footerP = document.createElement('p');
    footerP.textContent = 'Meowed! Extension 🐱';
    footer.appendChild(footerP);
    content.appendChild(footer);
    
    modal.appendChild(content);
    overlay.appendChild(modal);
    
    // Add overlay to body (not affected by blur)
    document.body.appendChild(overlay);
    
    // Ensure body has no margin/padding that could affect positioning
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.height = '100vh';
    document.body.style.overflow = 'hidden';
    
    // Add event listeners
    const closeBtnElement = document.getElementById('blocker-close');
    const backBtnElement = document.getElementById('blocker-back');
    const closeXBtnElement = document.getElementById('blocker-close-x');
    
    if (closeBtnElement) {
      closeBtnElement.addEventListener('click', async () => {
        try {
          // Send message to background script to close tab
          await chrome.runtime.sendMessage({ action: 'closeTab' });
        } catch (error) {
          // Fallback to window.close if message fails
          window.close();
        }
      });
    }
    
    if (closeXBtnElement) {
      closeXBtnElement.addEventListener('click', async () => {
        try {
          // Send message to background script to close tab
          await chrome.runtime.sendMessage({ action: 'closeTab' });
        } catch (error) {
          // Fallback to window.close if message fails
          window.close();
        }
      });
    }
    
    if (backBtnElement) {
      backBtnElement.addEventListener('click', () => {
        if (window.history.length > 1) {
          history.back();
        } else {
          // If no history, close tab
          chrome.runtime.sendMessage({ action: 'closeTab' }).catch(() => window.close());
        }
      });
    }
  }
  
  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Multiple triggers to ensure reliable blocking
  
  // 1. Check immediately
  performCheck();
  
  // 2. Check when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', performCheck);
  }
  
  // 3. Check when page is fully loaded
  window.addEventListener('load', performCheck);
  
  // 4. Check on focus (when user switches back to tab)
  window.addEventListener('focus', performCheck);
  
  // 5. Enhanced URL change detection for SPAs
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      if (DEBUG) console.log('Meowed! URL changed from', lastUrl, 'to', currentUrl);
      lastUrl = currentUrl;
      performCheck();
    }
  });
  
  urlObserver.observe(document, { childList: true });
  
  // 6. Listen for browser navigation events
  window.addEventListener('popstate', performCheck);
  window.addEventListener('pushstate', performCheck);
  window.addEventListener('replacestate', performCheck);
  
  // 7. Override history methods to catch programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    performCheck();
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    performCheck();
  };
  
  // 8. Periodic check as fallback (every 3 seconds)
  setInterval(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      performCheck();
    }
  }, 3000);
  
})(); 