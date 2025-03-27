
const state = {
    videos: [],
    playbackPosition: 0,
    settings: {
        scrollPause: true
    },
    whitelisted: false,
    lastScrollY: window.scrollY
};

// Improved whitelist check
function checkWhitelist() {
    chrome.runtime.sendMessage(
        { action: 'checkWhitelist', url: window.location.href },
        (response) => {
            state.whitelisted = response;
            console.log('Whitelist status:', state.whitelisted, 'for', window.location.href);
        }
    );
}

// Initialize
function init() {
    checkWhitelist();
    setupVideoTracking();
    setupEventListeners();
    
    // Listen for whitelist updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'whitelistUpdated') {
            checkWhitelist();
        }
    });
}



// Check if the current site is whitelisted
function checkWhitelist() {
    chrome.runtime.sendMessage(
        { action: 'checkWhitelist', url: window.location.href },
        (response) => {
            state.whitelisted = response;
        }
    );
}

// Video tracking
function setupVideoTracking() {
    function refreshVideos() {
        state.videos = Array.from(document.querySelectorAll('video'));
    }

    refreshVideos();
    setInterval(refreshVideos, 2000);
}

// Event listeners
function setupEventListeners() {
    // Message handling
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'getTimeAndPause':
                if (state.videos.length > 0 && !state.whitelisted) {
                    state.playbackPosition = state.videos[0].currentTime;
                    pauseAllVideos();
                }
                sendResponse({ time: state.playbackPosition });
                break;

            case 'resume':
                if (state.videos.length > 0 && message.time && !state.whitelisted) {
                    resumeAllVideos(message.time);
                }
                break;

            case 'updateSettings':
                state.settings = message.settings;
                break;
        }
        return true;
    });

    // Tab visibility
    document.addEventListener('visibilitychange', () => {
        if (!state.whitelisted && document.hidden) {
            pauseAllVideos();
        }
    });

    // Scroll pause
    window.addEventListener('scroll', () => {
        if (!state.whitelisted && state.settings.scrollPause) {
            const scrollDiff = Math.abs(window.scrollY - state.lastScrollY);
            if (scrollDiff > 100) {
                pauseAllVideos();
            }
            state.lastScrollY = window.scrollY;
        }
    });
}

// Video controls
function pauseAllVideos() {
    state.videos.forEach(v => {
        if (!v.paused) {
            v.pause();
            v.dataset.ekagraPaused = 'true';
        }
    });
}

function resumeAllVideos(time) {
    state.videos.forEach(v => {
        if (v.dataset.ekagraPaused === 'true') {
            v.currentTime = time;
            v.play()
                .then(() => delete v.dataset.ekagraPaused)
                .catch(e => console.log("Play failed:", e));
        }
    });
}

// Initialize
if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init);
}