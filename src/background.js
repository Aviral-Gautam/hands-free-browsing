// src/background.js

let trackerWindowId = null;
let isTrackingActive = false;

// Cross-browser runtime detection
const chromeOffscreen = typeof chrome !== 'undefined' ? chrome['offscreen'] : null;
const hasOffscreen = Boolean(chromeOffscreen && typeof chromeOffscreen.createDocument === 'function');

function broadcastToTabs(payload) {
  chrome.tabs.query({}, (tabs) => {
    if (!tabs) return;
    for (const tab of tabs) {
      if (!tab.id) continue;
      if (
        tab.url && (
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('moz-extension://') ||
          tab.url.startsWith('about:')
        )
      ) {
        continue;
      }
      chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
    }
  });
}

function broadcastToActiveTabs(payload) {
  // Query active tab in ALL windows so multi-window users receive face data correctly.
  // Without currentWindow: false, only the currently focused browser window gets updates.
  chrome.tabs.query({ active: true, currentWindow: false }, (tabs) => {
    if (!tabs) return;
    for (const tab of tabs) {
      if (!tab.id) continue;
      if (
        tab.url && (
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('moz-extension://') ||
          tab.url.startsWith('about:')
        )
      ) {
        continue;
      }
      chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
    }
  });
}

async function startTracker() {
  if (hasOffscreen && chromeOffscreen) {
    await setupOffscreenDocument('offscreen.html');
    isTrackingActive = true;
    broadcastToTabs({ type: 'TRACKER_STATUS_CHANGED', active: true });
    return { success: true, mode: 'offscreen' };
  } else {
    // Firefox / non-offscreen: use companion window
    if (trackerWindowId !== null) {
      try {
        const win = await chrome.windows.get(trackerWindowId);
        if (win) {
          await chrome.windows.update(trackerWindowId, { focused: true });
          isTrackingActive = true;
          broadcastToTabs({ type: 'TRACKER_STATUS_CHANGED', active: true });
          return { success: true, mode: 'window', windowId: trackerWindowId };
        }
      } catch {
        trackerWindowId = null;
      }
    }

    const win = await chrome.windows.create({
      url: chrome.runtime.getURL('offscreen.html'),
      type: 'popup',
      width: 360,
      height: 480,
      focused: true
    });

    trackerWindowId = win.id || null;
    isTrackingActive = true;
    broadcastToTabs({ type: 'TRACKER_STATUS_CHANGED', active: true });
    return { success: true, mode: 'window', windowId: trackerWindowId };
  }
}

async function stopTracker() {
  isTrackingActive = false;
  broadcastToTabs({ type: 'TRACKER_STATUS_CHANGED', active: false });

  if (hasOffscreen && chromeOffscreen) {
    try {
      await chromeOffscreen.closeDocument();
    } catch (e) {
      console.debug('Offscreen close suppressed:', e);
    }
  } else if (trackerWindowId !== null) {
    try {
      await chrome.windows.remove(trackerWindowId);
    } catch (e) {
      console.debug('Window close suppressed:', e);
    }
    trackerWindowId = null;
  }
  return { success: true };
}

async function setupOffscreenDocument(path) {
  if (!chromeOffscreen) return;
  const offscreenUrl = chrome.runtime.getURL(path);
  const runtimeGetContexts = chrome.runtime['getContexts'];
  if (typeof runtimeGetContexts === 'function') {
    const existingContexts = await runtimeGetContexts.call(chrome.runtime, {
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    if (existingContexts && existingContexts.length > 0) return;
  }

  await chromeOffscreen.createDocument({
    url: path,
    reasons: ['USER_MEDIA'],
    justification: 'Face tracking for cursor control requires continuous webcam access.'
  });
}

// Track window closing in Firefox
if (chrome.windows && chrome.windows.onRemoved) {
  chrome.windows.onRemoved.addListener((closedWindowId) => {
    if (closedWindowId === trackerWindowId) {
      trackerWindowId = null;
      isTrackingActive = false;
      broadcastToTabs({ type: 'TRACKER_STATUS_CHANGED', active: false });
    }
  });
}

// Auto-inject content script into already open tabs
async function injectContentScripts() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (chrome.scripting && typeof chrome.scripting.executeScript === 'function') {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.debug('Auto-injection suppressed:', e);
  }
}

// Listen for messages from Popup, Tracker, and Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FACE_DATA') {
    // Centralized relay: broadcast to all active tabs
    broadcastToActiveTabs(message);
    return false;
  }

  if (message.type === 'GET_TRACKER_STATUS') {
    sendResponse({
      active: isTrackingActive,
      trackerWindowId,
      mode: hasOffscreen ? 'offscreen' : 'window'
    });
    return true;
  }

  if (message.type === 'TOGGLE_TRACKER') {
    if (isTrackingActive) {
      stopTracker().then(sendResponse);
    } else {
      startTracker().then(sendResponse);
    }
    return true;
  }

  if (message.type === 'START_TRACKER') {
    startTracker().then(sendResponse);
    return true;
  }

  if (message.type === 'STOP_TRACKER') {
    stopTracker().then(sendResponse);
    return true;
  }

  if (message.type === 'TRACKER_STARTED') {
    isTrackingActive = true;
    broadcastToTabs({ type: 'TRACKER_STATUS_CHANGED', active: true });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'TRACKER_STOPPED') {
    isTrackingActive = false;
    broadcastToTabs({ type: 'TRACKER_STATUS_CHANGED', active: false });
    sendResponse({ ok: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('hands-free extension installed/reloaded');
  injectContentScripts();
});

chrome.runtime.onStartup?.addListener(() => {
  injectContentScripts();
});
