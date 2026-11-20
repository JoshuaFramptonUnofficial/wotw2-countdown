/* ==========================================
   05 REVIVE: UPDATE 2.0 — Release Countdown & Audio Manager
   ========================================== */

// ------------------------------------------
// Configuration
// ------------------------------------------
// Release Date: 20 November 2026 at 5:00 PM Eastern Standard Time (UTC-5)
const TARGET_DATE_ISO = '2026-11-20T17:00:00-05:00';

// Audio Playlist Array
const MUSIC_PLAYLIST = [
    'music1.mp3',
    'music2.mp3',
    'music3.mp3'
];

// Average duration per track in seconds (used for global Unix sync calculation)
const TRACK_DURATION_SEC = 180;

// Horn Audio Filename
const HORN_AUDIO_FILE = 'horn.mp3';

// 7 Hours in milliseconds (Weed crawling threshold)
const SEVEN_HOURS_MS = 7 * 60 * 60 * 1000;

// Post-release ash-grey decay duration in seconds
const DECAY_DURATION_SEC = 45;

// ------------------------------------------
// State Variables
// ------------------------------------------
const targetTimestamp = new Date(TARGET_DATE_ISO).getTime();
let audioEnabled = false;
let musicAudio = null;
let hornAudio = null;
let hasTriggeredRelease = false;
let countdownInterval = null;
let demoInterval = null;
let demoMode = false;
let soundButtonClicks = 0;
let soundButtonClickReset = null;

// DOM Elements
const elDays = document.getElementById('days');
const elHours = document.getElementById('hours');
const elMinutes = document.getElementById('minutes');
const elSeconds = document.getElementById('seconds');
const elSoundToggle = document.getElementById('sound-toggle');
const elCountdownStage = document.getElementById('countdown-stage');
const elRevealStage = document.getElementById('reveal-stage');
const elDemoPanel = document.getElementById('demo-panel');
const elDemoDays = document.getElementById('demo-days');
const elDemoHours = document.getElementById('demo-hours');
const elDemoMinutes = document.getElementById('demo-minutes');
const elDemoSeconds = document.getElementById('demo-seconds');

// ------------------------------------------
// Audio System & Mathematical Global Sync
// ------------------------------------------
function initAudio() {
    musicAudio = new Audio();
    musicAudio.loop = false;
    musicAudio.volume = 0.25;

    // Preload Horn Audio so it fires cleanly at T-0
    hornAudio = new Audio(HORN_AUDIO_FILE);
    hornAudio.volume = 1.0;
    hornAudio.load();

    musicAudio.addEventListener('ended', () => {
        if (MUSIC_PLAYLIST.length > 0) {
            syncGlobalAudio();
        }
    });

    musicAudio.addEventListener('error', () => {
        console.warn('Audio file missing or blocked:', MUSIC_PLAYLIST[0]);
    });
}

// Global Unix epoch synchronization so every visitor hears the exact same playback position
function syncGlobalAudio() {
    if (!audioEnabled || MUSIC_PLAYLIST.length === 0 || !musicAudio) return;

    const epochSec = Math.floor(Date.now() / 1000);
    const trackIndex = Math.floor(epochSec / TRACK_DURATION_SEC) % MUSIC_PLAYLIST.length;
    const trackPosition = epochSec % TRACK_DURATION_SEC;

    const selectedTrack = MUSIC_PLAYLIST[trackIndex];
    if (musicAudio.src !== selectedTrack && !musicAudio.src.endsWith(selectedTrack)) {
        musicAudio.src = selectedTrack;
    }

    try {
        musicAudio.currentTime = trackPosition;
    } catch (e) {
        // Fallback if metadata not loaded yet
    }

    musicAudio.play().catch(err => {
        console.warn('Browser blocked autoplay until user tap:', err);
    });
}

function toggleAudio() {
    if (!musicAudio) initAudio();

    audioEnabled = !audioEnabled;

    if (audioEnabled) {
        elSoundToggle.classList.remove('audio-muted');
        elSoundToggle.classList.add('audio-active');
        elSoundToggle.setAttribute('aria-label', 'Disable sound');
        elSoundToggle.setAttribute('aria-pressed', 'true');
        syncGlobalAudio();
    } else {
        elSoundToggle.classList.remove('audio-active');
        elSoundToggle.classList.add('audio-muted');
        elSoundToggle.setAttribute('aria-label', 'Enable sound');
        elSoundToggle.setAttribute('aria-pressed', 'false');
        if (musicAudio) musicAudio.pause();
    }
}

// 6-Click Secret Gesture to Open Visual Debug/Demo Panel
function handleSoundToggleClick() {
    toggleAudio();
    soundButtonClicks += 1;
    clearTimeout(soundButtonClickReset);
    soundButtonClickReset = setTimeout(() => {
        soundButtonClicks = 0;
    }, 4000);

    if (soundButtonClicks >= 6) {
        soundButtonClicks = 0;
        openDemoPanel();
    }
}

elSoundToggle.addEventListener('click', handleSoundToggleClick);

// ------------------------------------------
// Audio Volume & Ducking Controller
// ------------------------------------------
function updateAudioVolume(remainingMs) {
    if (!musicAudio || !audioEnabled || hasTriggeredRelease) return;

    // T-5 Seconds Ducking: Fade music down to silence for the Horn release blast
    if (remainingMs <= 5000 && remainingMs > 0) {
        const fadeRatio = Math.max(0, remainingMs / 5000);
        musicAudio.volume = 0.85 * fadeRatio;
    } else if (remainingMs <= 60000) {
        // Final minute: Maximum intensity volume (~0.85)
        musicAudio.volume = 0.85;
    } else if (remainingMs <= 600000) {
        // Final 10 minutes: Escalating volume (~0.5)
        musicAudio.volume = 0.5;
    } else {
        // Base volume (~0.25)
        musicAudio.volume = 0.25;
    }
}

// ------------------------------------------
// Red Weed Growth & Decay Logic
// ------------------------------------------
function updateRedWeedProgress(remainingMs) {
    if (hasTriggeredRelease) return;

    let progress = 0;
    if (remainingMs <= 0) {
        progress = 1.0;
    } else if (remainingMs <= SEVEN_HOURS_MS) {
        // Visible vines creeping in starting from 7 hours left
        const elapsed7h = 1.0 - (remainingMs / SEVEN_HOURS_MS);
        progress = 0.25 + (0.75 * Math.pow(elapsed7h, 1.2));
    } else {
        // More than 7 hours left: subtle background edge trace
        progress = 0.08;
    }

    document.documentElement.style.setProperty('--weed-progress', progress.toFixed(4));
}

function startPostReleaseDecay() {
    const startTime = Date.now();
    const durationMs = DECAY_DURATION_SEC * 1000;

    function decayStep() {
        const elapsed = Date.now() - startTime;
        const factor = Math.min(1, elapsed / durationMs);

        const saturation = Math.max(0, 100 - (factor * 100));
        const brightness = Math.max(0.4, 1.0 - (factor * 0.6));

        document.documentElement.style.setProperty('--weed-saturation', `${saturation.toFixed(1)}%`);
        document.documentElement.style.setProperty('--weed-brightness', brightness.toFixed(2));
        document.documentElement.style.setProperty('--horizon-red', '#120b0d');

        if (factor < 1) {
            requestAnimationFrame(decayStep);
        }
    }

    requestAnimationFrame(decayStep);
}

// ------------------------------------------
// Main Countdown Loop
// ------------------------------------------
function updateCountdown() {
    if (demoMode) return;

    const now = Date.now();
    const remainingMs = targetTimestamp - now;

    if (remainingMs <= 0) {
        renderTime(0, 0, 0, 0);
        triggerReleaseSequence();
        clearInterval(countdownInterval);
        return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    renderTime(days, hours, minutes, seconds);
    updateRedWeedProgress(remainingMs);
    updateAudioVolume(remainingMs);
}

function renderTime(d, h, m, s) {
    elDays.textContent = String(d).padStart(2, '0');
    elHours.textContent = String(h).padStart(2, '0');
    elMinutes.textContent = String(m).padStart(2, '0');
    elSeconds.textContent = String(s).padStart(2, '0');
}

// ------------------------------------------
// Zero Release Transition Sequence
// ------------------------------------------
function triggerReleaseSequence() {
    if (hasTriggeredRelease) return;
    hasTriggeredRelease = true;

    // 1. Set Red Weed to 100% max organic growth
    document.documentElement.style.setProperty('--weed-progress', '1.0');

    // 2. Fade out countdown numbers
    elCountdownStage.classList.add('fade-out');

    // 3. Silence Music and Play Tripod Horn
    if (musicAudio) {
        musicAudio.pause();
    }
    if (audioEnabled && hornAudio) {
        hornAudio.currentTime = 0;
        hornAudio.play().catch(err => console.warn('Horn audio playback blocked:', err));
    }

    // 4. Reveal Download Stage
    setTimeout(() => {
        elRevealStage.removeAttribute('aria-hidden');
        elRevealStage.classList.add('active');
        elCountdownStage.style.display = 'none';

        // 5. Begin 45-second organic red weed decay to ash grey
        startPostReleaseDecay();
    }, 1500);
}

// ------------------------------------------
// Demo / Test Panel Functionality
// ------------------------------------------
function getDemoDurationMs() {
    const days = Math.max(0, Number.parseInt(elDemoDays.value, 10) || 0);
    const hours = Math.max(0, Number.parseInt(elDemoHours.value, 10) || 0);
    const minutes = Math.max(0, Number.parseInt(elDemoMinutes.value, 10) || 0);
    const seconds = Math.max(0, Number.parseInt(elDemoSeconds.value, 10) || 0);
    return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

function startDemoCountdown() {
    clearInterval(demoInterval);
    demoMode = true;
    hasTriggeredRelease = false;

    elCountdownStage.style.display = '';
    elCountdownStage.classList.remove('fade-out');
    elRevealStage.classList.remove('active');
    elRevealStage.classList.add('aria-hidden');
    elRevealStage.setAttribute('aria-hidden', 'true');
    document.documentElement.style.setProperty('--weed-progress', '0.08');
    document.documentElement.style.setProperty('--weed-saturation', '100%');
    document.documentElement.style.setProperty('--weed-brightness', '1');

    let remainingMs = getDemoDurationMs();

    function demoStep() {
        const totalSeconds = Math.ceil(remainingMs / 1000);
        const days = Math.floor(totalSeconds / (3600 * 24));
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        renderTime(days, hours, minutes, seconds);
        updateRedWeedProgress(remainingMs);
        updateAudioVolume(remainingMs);

        if (remainingMs <= 0) {
            clearInterval(demoInterval);
            triggerReleaseSequence();
            return;
        }

        remainingMs -= 1000;
    }

    demoStep();
    demoInterval = setInterval(demoStep, 1000);
}

function showDemoEndState() {
    clearInterval(demoInterval);
    demoMode = true;
    hasTriggeredRelease = false;
    renderTime(0, 0, 0, 0);
    triggerReleaseSequence();
}

function hideDemoPanel() {
    // Simply hide the debug menu UI overlay without breaking or resetting any running test simulation
    elDemoPanel.classList.remove('active');
    elDemoPanel.setAttribute('aria-hidden', 'true');
}

function openDemoPanel() {
    elDemoPanel.classList.add('active');
    elDemoPanel.setAttribute('aria-hidden', 'false');
}

document.getElementById('demo-run').addEventListener('click', startDemoCountdown);
document.getElementById('demo-end').addEventListener('click', showDemoEndState);
document.getElementById('demo-hide').addEventListener('click', hideDemoPanel);
document.getElementById('demo-close').addEventListener('click', hideDemoPanel);

// Initialize live countdown on page load
updateCountdown();
countdownInterval = setInterval(updateCountdown, 1000);
