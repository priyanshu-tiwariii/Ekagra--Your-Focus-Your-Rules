
let videos = [];
let playbackPosition = 0;
function refreshVideos() {
    videos = Array.from(document.querySelectorAll('video'));
}
refreshVideos();
setInterval(refreshVideos, 2000);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'getTimeAndPause':
            // Get current time and pause
            if (videos.length > 0) {
                playbackPosition = videos[0].currentTime;
                videos.forEach(v => v.pause());
            }
            sendResponse({ time: playbackPosition });
            break;
            
        case 'resume':
            if (videos.length > 0 && message.time) {
                videos.forEach(v => {
                    v.currentTime = message.time;
                    v.play().catch(e => console.log("Play failed:", e));
                });
            }
            break;
    }
});


document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        videos.forEach(v => v.pause());
    }
});