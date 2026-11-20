/* ==========================================
   05 REVIVE: UPDATE 2.0 — Release Countdown & Audio Manager
   ========================================== */

// ------------------------------------------
// Configuration
// ------------------------------------------
// Release Date: 20 November 2026 at 5:00 PM Eastern Standard Time (UTC-5)
const TARGET_DATE_ISO = '2026-11-20T17:00:00-05:00';

// Audio Playlist Array — Add or remove background music filenames here
const MUSIC_PLAYLIST = [
    'music1.mp3',
    'music2.mp3',
    'music3.mp3'
];

// Horn Audio Filename
const HORN_AUDIO_FILE = 'horn.mp3';

// Reference total duration for Weed Growth Progression (14 Days in ms)
const WEED_START_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// Post-release decay duration (in seconds)
const DECAY_DURATION_SEC = 45;

// ------------------------------------------
// State Variables
// ------------------------------------------
const targetTimestamp = new Date(TARGET_DATE_ISO).getTime();
let audioEnabled = false;
let currentTrackIndex = 0;
let musicAudio = null;
let hornAudio = null;
let hasTriggeredRelease = false;
let countdownInterval = null;
let demoInterval = null;
let releaseRevealTimeout = null;
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
// Audio Initialization & Toggle
// ------------------------------------------
function initAudio() {
    musicAudio = new Audio();
    musicAudio.loop = false;
    musicAudio.volume = 0.25;

    // Cycle to next track when current track finishes
    musicAudio.addEventListener('ended', () => {
        if (MUSIC_PLAYLIST.length > 0) {
            currentTrackIndex = (currentTrackIndex + 1) % MUSIC_PLAYLIST.length;
            playCurrentTrack();
        }
    });

    // Audio error fallback logging
    musicAudio.addEventListener('error', () => {
        console.warn('Audio track load error for:', MUSIC_PLAYLIST[currentTrackIndex]);
    });

    hornAudio = new Audio(HORN_AUDIO_FILE);
    hornAudio.volume = 1.0;
}

function playCurrentTrack() {
    if (!audioEnabled || MUSIC_PLAYLIST.length === 0) return;
    musicAudio.src = MUSIC_PLAYLIST[currentTrackIndex];
    musicAudio.play().catch(err => {
        console.warn('Playback prevented by browser until user interaction:', err);
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
        playCurrentTrack();
    } else {
        elSoundToggle.classList.remove('audio-active');
        elSoundToggle.classList.add('audio-muted');
        elSoundToggle.setAttribute('aria-label', 'Enable sound');
        elSoundToggle.setAttribute('aria-pressed', 'false');
        if (musicAudio) musicAudio.pause();
    }
}

function handleSoundToggleClick() {
    toggleAudio();
    soundButtonClicks += 1;
    clearTimeout(soundButtonClickReset);
    soundButtonClickReset = setTimeout(() => {
        soundButtonClicks = 0;
    }, 5000);

    if (soundButtonClicks === 6) {
        soundButtonClicks = 0;
        openDemoPanel();
    }
}

elSoundToggle.addEventListener('click', handleSoundToggleClick);

// ------------------------------------------
// Dynamic Volume Escalation
// ------------------------------------------
function updateAudioVolume(remainingMs) {
    if (!musicAudio || !audioEnabled || hasTriggeredRelease) return;

    if (remainingMs <= 60000) {
        // Final minute: Max intensity volume (~0.85)
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
// Red Weed Growth & Decay Controller
// ------------------------------------------
function updateRedWeedProgress(remainingMs) {
    if (hasTriggeredRelease) return;

    let progress = 0;
    if (remainingMs <= 0) {
        progress = 1.0;
    } else if (remainingMs < WEED_START_WINDOW_MS) {
        progress = 1.0 - (remainingMs / WEED_START_WINDOW_MS);
        if (remainingMs <= 60000) {
            progress = Math.max(progress, 0.95);
        }
    } else {
        progress = 0.05;
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
        const brightness = Math.max(0.45, 1.0 - (factor * 0.55));

        document.documentElement.style.setProperty('--weed-saturation', `${saturation.toFixed(1)}%`);
        document.documentElement.style.setProperty('--weed-brightness', brightness.toFixed(2));
        document.documentElement.style.setProperty('--horizon-red', '#140c0e');

        if (factor < 1) {
            requestAnimationFrame(decayStep);
        }
    }

    requestAnimationFrame(decayStep);
}

// ------------------------------------------
// Countdown Timer Loop
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
// Zero Transition Sequence
// ------------------------------------------
function triggerReleaseSequence() {
    if (hasTriggeredRelease) return;
    hasTriggeredRelease = true;

    // 1. Set Weed to max growth
    document.documentElement.style.setProperty('--weed-progress', '1.0');

    // 2. Fade out countdown stage
    elCountdownStage.classList.add('fade-out');

    // 3. Audio handling: Fade out music, play Horn
    if (!demoMode && audioEnabled && musicAudio) {
        let fadeVolume = musicAudio.volume;
        const fadeInterval = setInterval(() => {
            fadeVolume -= 0.05;
            if (fadeVolume <= 0) {
                musicAudio.pause();
                clearInterval(fadeInterval);
            } else {
                musicAudio.volume = fadeVolume;
            }
        }, 100);

        if (hornAudio) {
            hornAudio.play().catch(err => console.warn('Horn audio playback blocked:', err));
        }
    }

    // 4. Reveal Download Button
    releaseRevealTimeout = setTimeout(() => {
        elRevealStage.removeAttribute('aria-hidden');
        elRevealStage.classList.add('active');
        elCountdownStage.style.display = 'none';

        // 5. Begin 45-second organic red weed decay (wither to ash grey)
        startPostReleaseDecay();
    }, 1500);
}

function getDemoDurationMs() {
    const days = Math.max(0, Number.parseInt(elDemoDays.value, 10) || 0);
    const hours = Math.max(0, Number.parseInt(elDemoHours.value, 10) || 0);
    const minutes = Math.max(0, Number.parseInt(elDemoMinutes.value, 10) || 0);
    const seconds = Math.max(0, Number.parseInt(elDemoSeconds.value, 10) || 0);
    return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

function resetReleaseView() {
    clearTimeout(releaseRevealTimeout);
    clearInterval(demoInterval);
    hasTriggeredRelease = false;
    elCountdownStage.style.display = '';
    elCountdownStage.classList.remove('fade-out');
    elRevealStage.classList.remove('active');
    elRevealStage.classList.add('aria-hidden');
    elRevealStage.setAttribute('aria-hidden', 'true');
    document.documentElement.style.setProperty('--weed-progress', '0.05');
    document.documentElement.style.setProperty('--weed-saturation', '100%');
    document.documentElement.style.setProperty('--weed-brightness', '1');
    document.documentElement.style.setProperty('--horizon-red', '#3b0008');
}

function startDemoCountdown() {
    resetReleaseView();
    demoMode = true;
    let remainingMs = getDemoDurationMs();

    function demoStep() {
        const totalSeconds = Math.ceil(remainingMs / 1000);
        const days = Math.floor(totalSeconds / (3600 * 24));
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        renderTime(days, hours, minutes, seconds);
        updateRedWeedProgress(remainingMs);

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
    resetReleaseView();
    demoMode = true;
    renderTime(0, 0, 0, 0);
    triggerReleaseSequence();
}

function closeDemoPanel() {
    clearInterval(demoInterval);
    demoMode = false;
    resetReleaseView();
    updateCountdown();
    elDemoPanel.classList.remove('active');
    elDemoPanel.setAttribute('aria-hidden', 'true');
}

function openDemoPanel() {
    demoMode = true;
    clearInterval(demoInterval);
    elDemoPanel.classList.add('active');
    elDemoPanel.setAttribute('aria-hidden', 'false');
}

document.getElementById('demo-run').addEventListener('click', startDemoCountdown);
document.getElementById('demo-end').addEventListener('click', showDemoEndState);
document.getElementById('demo-close').addEventListener('click', closeDemoPanel);

// Initialize on page load
updateCountdown();
countdownInterval = setInterval(updateCountdown, 1000);
