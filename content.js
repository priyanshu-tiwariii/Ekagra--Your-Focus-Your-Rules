const state = {
    videos: [],
    playbackPositions: new Map(),
    settings: null, 
    whitelisted: false,
    scrollTimeout: null
};

// Check whitelist status -----------------------------------------------------------------------------------------------------------
function checkWhitelist(callback) {
    chrome.runtime.sendMessage({ 
        action: 'checkWhitelist', 
        url: window.location.href 
    }, (response) => {
        state.whitelisted = response;
        if (callback) callback();
    });
}

// Setup video tracking -----------------------------------------------------------------------------------------------------------
function setupVideoTracking() {
    const refreshVideos = () => {
        state.videos = Array.from(document.querySelectorAll('video'));
    };
    
    refreshVideos();
    
    const observer = new MutationObserver(refreshVideos);
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
}

// Video control functions -----------------------------------------------------------------------------------------------------------
function pauseAllVideos() {
    state.videos.forEach(v => {
        if (!v.paused) {
            v.pause();
            v.dataset.ekagraPaused = 'true';
        }
    });
}

function resumeAllVideos(playbackPositions) {
    state.videos.forEach(v => {
        if (v.dataset.ekagraPaused === 'true') {
            const savedTime = playbackPositions.get(v) || 0;
            v.currentTime = savedTime;
            v.play()
                .then(() => delete v.dataset.ekagraPaused)
                .catch(e => console.log("Play failed:", e));
        }
    });
}

// Setup event listeners -----------------------------------------------------------------------------------------------------------
function setupEventListeners() {
    const handleScroll = () => {
        if (state.whitelisted || !state.settings?.scrollPause) return;
        
        clearTimeout(state.scrollTimeout);
        state.scrollTimeout = setTimeout(() => {
            if (window.scrollY > 100) {
                state.videos.forEach(v => {
                    state.playbackPositions.set(v, v.currentTime);
                });
                pauseAllVideos();
            } else if (window.scrollY <= 80) {
                resumeAllVideos(state.playbackPositions);
            }
        }, 200);
    };

    window.addEventListener("scroll", handleScroll);

    // Visibility change handler -------------------------------------------------------------------------------------------------------
    document.addEventListener("visibilitychange", () => {
        if (state.whitelisted) return;
        
        if (document.hidden) {
            state.videos.forEach(v => {
                state.playbackPositions.set(v, v.currentTime);
            });
            pauseAllVideos();
        } else {
            resumeAllVideos(state.playbackPositions);
        }
    });
}

// Initialize the script ------------------------------------------------------------------------------------------------------------
function init() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        state.settings = response || { scrollPause: true };
        checkWhitelist(() => {
            setupVideoTracking();
            setupEventListeners();
        });
    });

    // Message listener for updates ---------------------------------------------------------------------------------
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'whitelistUpdated') {
            checkWhitelist();
        } else if (message.action === 'settingsUpdated') {
            state.settings = message.settings;
        }
    });
}

// Run initialization-------------------------------------------------------------------------------------------------------
if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init);
}