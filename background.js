let previousTabId = null;
const pausedTabs = new Map(); 

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    console.log('Switched to tab ID', activeInfo.tabId);

    // STEP 1: Pause previous tab
    if (previousTabId) {
        console.log("Pausing tab ID:", previousTabId);
        try {
           
            const response = await chrome.tabs.sendMessage(previousTabId, { 
                action: 'getTimeAndPause' 
            });
            
            if (response && response.time) {
                pausedTabs.set(previousTabId, response.time);
            }
        } catch (error) {
            console.log("Tab not responsive:", error);
        }
    }

    // STEP 2: Inject content script (if not already there)
    try {
        await chrome.scripting.executeScript({
            target: { tabId: activeInfo.tabId },
            files: ['content.js']
        });
        console.log('Injected content.js');
    } catch (error) {
        console.log('Injection failed (maybe already injected):', error);
    }

    // STEP 3: Resume if returning to paused tab
    if (pausedTabs.has(activeInfo.tabId)) {
        console.log("Resuming tab ID:", activeInfo.tabId);
        try {
            await chrome.tabs.sendMessage(activeInfo.tabId, { 
                action: 'resume',
                time: pausedTabs.get(activeInfo.tabId)
            });
            pausedTabs.delete(activeInfo.tabId);
        } catch (error) {
            console.log("Resume failed:", error);
        }
    }

    // STEP 4: Update previous tab ID
    previousTabId = activeInfo.tabId;
});

chrome.tabs.onRemoved.addListener((tabId) => {
    pausedTabs.delete(tabId);
    if (previousTabId === tabId) {
        previousTabId = null;
    }
});