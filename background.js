let previousTabId = null;
const pausedTabs = new Map();
let whitelist = [];

// Load saved settings
chrome.storage.sync.get(['whitelist', 'settings'], (result) => {
    whitelist = result.whitelist || [];
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'checkWhitelist':
            const url = new URL(message.url);
            const isWhitelisted = whitelist.some(site => {
                try {
                    const siteUrl = new URL(site.startsWith('http') ? site : `https://${site}`);
                    return (url.hostname === siteUrl.hostname || 
                            url.hostname.endsWith(`.${siteUrl.hostname}`));
                } catch {
                    return message.url.includes(site); // fallback
                }
            });
            sendResponse(isWhitelisted);
            break;

        case 'updateWhitelist':
            whitelist = message.whitelist;
            chrome.storage.sync.set({ whitelist });
            // Notify all tabs about whitelist update
            chrome.tabs.query({}, tabs => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'whitelistUpdated' });
                });
            });
            break;
            
        case 'getSettings':
            chrome.storage.sync.get(['settings'], (result) => {
                sendResponse(result.settings || {
                    scrollPause: true
                });
            });
            return true;
    }
});

// Handle tab switching
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // Pause previous tab
    if (previousTabId) {
        try {
            const response = await chrome.tabs.sendMessage(previousTabId, {
                action: 'getTimeAndPause'
            });

            if (response && response.time) {
                pausedTabs.set(previousTabId, response.time);
            }
        } catch (error) {
            console.log("Tab pause error:", error);
        }
    }

    // Resume paused tab
    if (pausedTabs.has(activeInfo.tabId)) {
        try {
            await chrome.tabs.sendMessage(activeInfo.tabId, {
                action: 'resume',
                time: pausedTabs.get(activeInfo.tabId)
            });
            pausedTabs.delete(activeInfo.tabId);
        } catch (error) {
            console.log("Resume error:", error);
        }
    }

    previousTabId = activeInfo.tabId;
});

// Handle tab close
chrome.tabs.onRemoved.addListener((tabId) => {
    pausedTabs.delete(tabId);
    if (previousTabId === tabId) {
        previousTabId = null;
    }
});

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ whitelist: [] });
});