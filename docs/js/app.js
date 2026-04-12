import { ConnectionManager } from './connection.js';
import { Timer } from './timer.js';
import { MODES, getCustomCommands, saveCustomCommands, addCustomCommand, removeCustomCommand } from './modes.js';
import {
    saveConnectionUrl, getConnectionUrl,
    saveSelectedMode, getSelectedMode,
    exportConfig, importConfig, downloadConfigFile, clearAll, StorageKeys,
} from './storage.js';

/* ================================================
   DOM References
   ================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    // Setup
    setupScreen: $('#setup-screen'),
    setupUrl: $('#setup-url'),
    setupConnect: $('#setup-connect'),
    // Timer bar
    timerDisplay: $('#timer-display'),
    timerPlayPause: $('#timer-play-pause'),
    timerReset: $('#timer-reset'),
    statusDot: $('#status-dot'),
    receiverStatus: $('#receiver-status'),
    gearBtn: $('#gear-btn'),
    // Mode tabs
    modeTabs: $('#mode-tabs'),
    commandsArea: $('#commands-area'),
    // Settings overlay
    settingsOverlay: $('#settings-overlay'),
    settingsClose: $('#settings-close'),
    settingsUrl: $('#settings-url'),
    settingsUrlSave: $('#settings-url-save'),
    settingsExport: $('#settings-export'),
    settingsImportFile: $('#settings-import-file'),
    settingsClear: $('#settings-clear'),
    settingsDisconnect: $('#settings-disconnect'),
    // Timer settings within overlay
    timerModeStopwatch: $('#timer-mode-stopwatch'),
    timerModeCountdown: $('#timer-mode-countdown'),
    countdownSection: $('#countdown-section'),
    countdownH: $('#countdown-h'),
    countdownM: $('#countdown-m'),
    countdownS: $('#countdown-s'),
    timerStartBtn: $('#timer-start-btn'),
    // Custom command dialog
    customDialog: $('#custom-dialog'),
    customDialogClose: $('#custom-dialog-close'),
    customLabel: $('#custom-label'),
    customAction: $('#custom-action'),
    customIcon: $('#custom-icon'),
    customSave: $('#custom-save'),
    customDelete: $('#custom-delete'),
};

/* ================================================
   State
   ================================================ */
let currentMode = getSelectedMode();
let timerSettingMode = 'stopwatch'; // which mode the settings panel shows
let editingCustomIndex = -1;        // -1 = adding new
let wakeLock = null;

/* ================================================
   Connection Manager
   ================================================ */
const connection = new ConnectionManager(onStatusChange, onMessage);

function onStatusChange(status) {
    const dot = dom.statusDot;
    dot.className = 'status-dot';
    if (status === 'connected') dot.classList.add('connected');
    else if (status === 'connecting') dot.classList.add('connecting');
}

function onMessage(data) {
    // For now, just log inbound messages — future: display on screen
    console.log('[Remote] Received:', data);
}

/* ================================================
   Timer
   ================================================ */
const timer = new Timer(onTimerTick, onTimerAlert);

function onTimerTick(display) {
    updateTimerDisplay();
}

function onTimerAlert() {
    dom.timerDisplay.classList.add('alert');
    if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 300]);
    }
}

function updateTimerDisplay() {
    const display = timer.getDisplay();
    dom.timerDisplay.textContent = display;
    dom.timerDisplay.classList.remove('countdown', 'alert');
    if (timer.mode === 'countdown' && timer.isRunning) {
        dom.timerDisplay.classList.add('countdown');
        if (timer.getRemainingMs() <= 0) {
            dom.timerDisplay.classList.add('alert');
        }
    }
    // Update play/pause button
    dom.timerPlayPause.textContent = timer.isRunning ? '⏸' : '▶';
}

/* ================================================
   Wake Lock
   ================================================ */
async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {
        // Wake lock not available or denied
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !wakeLock) {
        requestWakeLock();
    }
});

/* ================================================
   Mode Rendering
   ================================================ */
function renderModeTabs() {
    const tabsContainer = dom.modeTabs;
    tabsContainer.innerHTML = '';

    const allModes = { ...MODES, custom: { name: 'Custom', icon: '🛠' } };
    for (const [key, mode] of Object.entries(allModes)) {
        const btn = document.createElement('button');
        btn.className = 'mode-tab' + (key === currentMode ? ' active' : '');
        btn.textContent = `${mode.icon} ${mode.name}`;
        btn.dataset.mode = key;
        btn.addEventListener('click', () => switchMode(key));
        tabsContainer.appendChild(btn);
    }
}

function switchMode(mode) {
    currentMode = mode;
    saveSelectedMode(mode);
    renderModeTabs();
    renderCommands();
}

function renderCommands() {
    const area = dom.commandsArea;
    area.innerHTML = '';
    area.dataset.mode = currentMode;

    let commands;
    if (currentMode === 'custom') {
        commands = getCustomCommands();
    } else {
        commands = MODES[currentMode]?.commands || [];
    }

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const btn = document.createElement('button');
        btn.className = `cmd-btn ${cmd.class || 'btn-secondary'}`;
        btn.innerHTML = `<span class="icon">${cmd.icon || ''}</span> ${cmd.label}`;
        btn.addEventListener('click', () => {
            if (navigator.vibrate) navigator.vibrate(50);
            connection.sendCommand(currentMode, cmd.action);
        });
        // Long-press to edit custom commands
        if (currentMode === 'custom') {
            let pressTimer = null;
            btn.addEventListener('pointerdown', () => {
                pressTimer = setTimeout(() => openCustomDialog(i), 500);
            });
            btn.addEventListener('pointerup', () => clearTimeout(pressTimer));
            btn.addEventListener('pointerleave', () => clearTimeout(pressTimer));
        }
        area.appendChild(btn);
    }

    // Custom mode: add button
    if (currentMode === 'custom') {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-custom-btn';
        addBtn.textContent = '+ Add Command';
        addBtn.addEventListener('click', () => openCustomDialog(-1));
        area.appendChild(addBtn);
    }
}

/* ================================================
   Custom Command Dialog
   ================================================ */
function openCustomDialog(index) {
    editingCustomIndex = index;
    if (index >= 0) {
        const cmds = getCustomCommands();
        const cmd = cmds[index];
        dom.customLabel.value = cmd.label || '';
        dom.customAction.value = cmd.action || '';
        dom.customIcon.value = cmd.icon || '';
        dom.customDelete.classList.remove('hidden');
    } else {
        dom.customLabel.value = '';
        dom.customAction.value = '';
        dom.customIcon.value = '🔘';
        dom.customDelete.classList.add('hidden');
    }
    dom.customDialog.classList.add('open');
}

function closeCustomDialog() {
    dom.customDialog.classList.remove('open');
}

/* ================================================
   Settings Overlay
   ================================================ */
function openSettings() {
    dom.settingsUrl.value = getConnectionUrl();
    dom.settingsOverlay.classList.add('open');
    updateTimerSettingsUI();
}

function closeSettings() {
    dom.settingsOverlay.classList.remove('open');
}

function updateTimerSettingsUI() {
    dom.timerModeStopwatch.classList.toggle('active', timerSettingMode === 'stopwatch');
    dom.timerModeCountdown.classList.toggle('active', timerSettingMode === 'countdown');
    dom.countdownSection.classList.toggle('hidden', timerSettingMode !== 'countdown');
}

/* ================================================
   Setup Screen
   ================================================ */
function showSetup() {
    dom.setupScreen.classList.remove('hidden');
}

function hideSetup() {
    dom.setupScreen.classList.add('hidden');
}

function connectWithUrl(url) {
    if (!url || !url.trim()) return;
    url = url.trim();
    saveConnectionUrl(url);
    connection.connect(url);
    hideSetup();
}

/* ================================================
   Event Listeners
   ================================================ */
function bindEvents() {
    // Setup screen
    dom.setupConnect.addEventListener('click', () => {
        connectWithUrl(dom.setupUrl.value);
    });
    dom.setupUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') connectWithUrl(dom.setupUrl.value);
    });

    // Timer bar controls
    dom.timerPlayPause.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(30);
        if (timer.mode === 'idle') {
            // Default: start a stopwatch
            timer.startStopwatch();
        } else if (timer.isRunning) {
            timer.pause();
        } else {
            timer.resume();
        }
        updateTimerDisplay();
    });

    dom.timerReset.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(30);
        timer.reset();
        dom.timerDisplay.classList.remove('alert', 'countdown');
        updateTimerDisplay();
    });

    // Gear → settings
    dom.gearBtn.addEventListener('click', openSettings);
    dom.settingsClose.addEventListener('click', closeSettings);
    dom.settingsOverlay.addEventListener('click', (e) => {
        if (e.target === dom.settingsOverlay) closeSettings();
    });

    // Settings: connection URL
    dom.settingsUrlSave.addEventListener('click', () => {
        const url = dom.settingsUrl.value.trim();
        if (url) {
            connection.disconnect();
            connectWithUrl(url);
            closeSettings();
        }
    });

    dom.settingsDisconnect.addEventListener('click', () => {
        connection.disconnect();
    });

    // Settings: export / import / clear
    dom.settingsExport.addEventListener('click', () => {
        downloadConfigFile();
    });

    dom.settingsImportFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                importConfig(ev.target.result);
                // Reload state
                const url = getConnectionUrl();
                if (url) {
                    connection.disconnect();
                    connection.connect(url);
                }
                currentMode = getSelectedMode();
                renderModeTabs();
                renderCommands();
                closeSettings();
            } catch (err) {
                alert('Invalid config file.');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // reset
    });

    dom.settingsClear.addEventListener('click', () => {
        if (confirm('Clear all settings and data?')) {
            connection.disconnect();
            timer.reset();
            clearAll();
            currentMode = 'powerpoint';
            renderModeTabs();
            renderCommands();
            updateTimerDisplay();
            showSetup();
            closeSettings();
        }
    });

    // Timer settings: mode toggle
    dom.timerModeStopwatch.addEventListener('click', () => {
        timerSettingMode = 'stopwatch';
        updateTimerSettingsUI();
    });

    dom.timerModeCountdown.addEventListener('click', () => {
        timerSettingMode = 'countdown';
        updateTimerSettingsUI();
    });

    // Timer settings: start
    dom.timerStartBtn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(30);
        timer.reset();
        dom.timerDisplay.classList.remove('alert', 'countdown');

        if (timerSettingMode === 'countdown') {
            const h = parseInt(dom.countdownH.value, 10) || 0;
            const m = parseInt(dom.countdownM.value, 10) || 0;
            const s = parseInt(dom.countdownS.value, 10) || 0;
            const total = (h * 3600 + m * 60 + s) * 1000;
            if (total <= 0) return;
            // Save prefs
            localStorage.setItem(StorageKeys.TIMER_PREFS, JSON.stringify({ h, m, s }));
            timer.startCountdown(total);
        } else {
            timer.startStopwatch();
        }
        updateTimerDisplay();
        closeSettings();
    });

    // Restore countdown prefs
    try {
        const prefs = JSON.parse(localStorage.getItem(StorageKeys.TIMER_PREFS));
        if (prefs) {
            dom.countdownH.value = prefs.h || 0;
            dom.countdownM.value = prefs.m || 0;
            dom.countdownS.value = prefs.s || 0;
        }
    } catch { /* ignore */ }

    // Custom command dialog
    dom.customDialogClose.addEventListener('click', closeCustomDialog);
    dom.customDialog.addEventListener('click', (e) => {
        if (e.target === dom.customDialog) closeCustomDialog();
    });

    dom.customSave.addEventListener('click', () => {
        const label = dom.customLabel.value.trim();
        const action = dom.customAction.value.trim();
        const icon = dom.customIcon.value.trim() || '🔘';
        if (!label || !action) return;

        if (editingCustomIndex >= 0) {
            const cmds = getCustomCommands();
            cmds[editingCustomIndex] = { label, action, icon, class: 'btn-secondary' };
            saveCustomCommands(cmds);
        } else {
            addCustomCommand(label, action, icon);
        }
        closeCustomDialog();
        renderCommands();
    });

    dom.customDelete.addEventListener('click', () => {
        if (editingCustomIndex >= 0) {
            removeCustomCommand(editingCustomIndex);
            closeCustomDialog();
            renderCommands();
        }
    });
}

/* ================================================
   Initialization
   ================================================ */
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    renderModeTabs();
    renderCommands();

    // Restore timer
    timer.restoreState();
    updateTimerDisplay();

    // Check for stored connection URL
    const storedUrl = getConnectionUrl();
    if (storedUrl) {
        hideSetup();
        connection.connect(storedUrl);
    } else {
        showSetup();
    }

    // Wake Lock
    requestWakeLock();

    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Update receiver presence indicator every 2 seconds
    setInterval(updateReceiverStatus, 2000);
});

function updateReceiverStatus() {
    const el = dom.receiverStatus;
    if (connection.receiverActive) {
        el.classList.add('active');
        el.classList.remove('stale');
        el.title = 'Receiver: active';
    } else if (connection.lastReceiverSeen) {
        el.classList.remove('active');
        el.classList.add('stale');
        const t = new Date(connection.lastReceiverSeen).toLocaleTimeString();
        el.title = `Receiver: last seen ${t}`;
    } else {
        el.classList.remove('active', 'stale');
        el.title = 'Receiver: not detected';
    }
}
