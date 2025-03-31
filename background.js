let previousTabId = null;
const pausedTabs = new Map();
let whitelist = [];
let settings = { scrollPause: true };

// Load saved settings -----------------------------------------------------------------------------------------------------------------
chrome.storage.sync.get(['whitelist', 'settings'], (result) => {
    whitelist = result.whitelist || [];
    settings = result.settings || { scrollPause: true };
});

// Handle incoming messages ----------------------------------------------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'checkWhitelist': {
            const url = new URL(message.url);
            const isWhitelisted = whitelist.some(site => {
                try {
                    const siteUrl = new URL(site.startsWith('http') ? site : `https://${site}`);
                    return (url.hostname === siteUrl.hostname || url.hostname.endsWith(`.${siteUrl.hostname}`));
                } catch {
                    return message.url.includes(site);
                }
            });
            sendResponse(isWhitelisted);
            break;
        }

        case 'updateWhitelist':
            whitelist = message.whitelist;
            chrome.storage.sync.set({ whitelist });
            chrome.tabs.query({}, tabs => {
                tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { action: 'whitelistUpdated' }));
            });
            break;

        case 'getSettings':
            sendResponse(settings);
            break;

        case 'updateSettings':
            settings = message.settings;
            chrome.storage.sync.set({ settings });
            chrome.tabs.query({}, tabs => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { 
                        action: 'settingsUpdated', 
                        settings: settings 
                    }).catch(e => console.log("Tab not ready:", e));
                });
            });
            break;
    }
    return true;
});

// Handle tab switching-----------------------------------------------------------------------------------------------------------------
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    if (previousTabId) {
        try {
            const response = await chrome.tabs.sendMessage(previousTabId, { 
                action: "getTimeAndPause" 
            });
            if (response?.playbackPositions) {
                pausedTabs.set(previousTabId, response.playbackPositions);
            }
        } catch (error) {
            console.log("Tab pause error:", error);
        }
    }

    if (pausedTabs.has(activeInfo.tabId)) {
        try {
            await chrome.tabs.sendMessage(activeInfo.tabId, {
                action: "resume",
                playbackPositions: pausedTabs.get(activeInfo.tabId),
            });
            pausedTabs.delete(activeInfo.tabId);
        } catch (error) {
            console.log("Resume error:", error);
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: activeInfo.tabId },
                    files: ["content.js"],
                });
                await chrome.tabs.sendMessage(activeInfo.tabId, {
                    action: "resume",
                    playbackPositions: pausedTabs.get(activeInfo.tabId),
                });
                pausedTabs.delete(activeInfo.tabId);
            } catch (e) {
                console.log("Injection failed:", e);
            }
        }
    }
    previousTabId = activeInfo.tabId;
});

// Handle tab closure --------------------------------------------------------------------------------------------------------------------
chrome.tabs.onRemoved.addListener((tabId) => {
    pausedTabs.delete(tabId);
    if (previousTabId === tabId) previousTabId = null;
});

// Initialize storage -------------------------------------------------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['whitelist', 'settings'], (result) => {
        if (!result.settings) {
            chrome.storage.sync.set({ settings: { scrollPause: true } });
        }
        if (!result.whitelist) {
            chrome.storage.sync.set({ whitelist: [] });
        }
    });
});