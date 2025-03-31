document.addEventListener('DOMContentLoaded', () => {
    const scrollToggle = document.getElementById('scrollToggle');
    const whitelistInput = document.getElementById('whitelistInput');
    const addBtn = document.getElementById('addWhitelist');
    const whitelistEl = document.getElementById('whitelist');

    // Load initial state ---------------------------------------------------------------------------------
    chrome.storage.sync.get(['settings', 'whitelist'], (result) => {
        scrollToggle.checked = result.settings?.scrollPause ?? true;
        renderWhitelist(result.whitelist || []);
    });

    // Handle scroll toggle changes ------------------------------------------------------------------
    scrollToggle.addEventListener('change', (e) => {
        const newSettings = { 
            scrollPause: e.target.checked 
        };
        
        chrome.storage.sync.set({ settings: newSettings }, () => {
            chrome.runtime.sendMessage({
                action: 'updateSettings',
                settings: newSettings
            });
        });
    });

    function renderWhitelist(list) {
        whitelistEl.innerHTML = '';
        list.forEach(site => {
            const li = document.createElement('li');
            li.textContent = site;
            
            const btn = document.createElement('button');
            btn.textContent = '❌';
            btn.dataset.site = site;
            btn.addEventListener('click', handleRemoveSite);
            
            li.appendChild(btn);
            whitelistEl.appendChild(li);
        });
    }

    function handleRemoveSite(e) {
        const site = e.target.dataset.site;
        chrome.storage.sync.get(['whitelist'], (result) => {
            const updated = (result.whitelist || []).filter(s => s !== site);
            chrome.storage.sync.set({ whitelist: updated }, () => {
                renderWhitelist(updated);
                chrome.runtime.sendMessage({
                    action: 'updateWhitelist',
                    whitelist: updated
                });
            });
        });
    }

    addBtn.addEventListener('click', () => {
        const site = whitelistInput.value.trim();
        if (!site || site.length < 3) return;
        
        chrome.storage.sync.get(['whitelist'], (result) => {
            const updated = [...new Set([...(result.whitelist || []), site])];
            chrome.storage.sync.set({ whitelist: updated }, () => {
                whitelistInput.value = '';
                renderWhitelist(updated);
                chrome.runtime.sendMessage({
                    action: 'updateWhitelist',
                    whitelist: updated
                });
            });
        });
    });
});