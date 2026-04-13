import { ConnectionManager } from './connection.js';
import { Timer } from './timer.js';
import { MODES, getCustomCommands, saveCustomCommands, addCustomCommand, removeCustomCommand } from './modes.js';
import {
    saveConnectionString, getConnectionString,
    saveHubName, getHubName,
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
    setupConnStr: $('#setup-connstr'),
    setupHub: $('#setup-hub'),
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
    commandsTop: $('#commands-top'),
    commandsBottom: $('#commands-bottom'),
    // Settings overlay
    settingsOverlay: $('#settings-overlay'),
    settingsClose: $('#settings-close'),
    settingsConnStr: $('#settings-connstr'),
    settingsHub: $('#settings-hub'),
    settingsHeartbeat: $('#settings-heartbeat'),
    settingsUrlSave: $('#settings-url-save'),
    settingsExport: $('#settings-export'),
    settingsImportFile: $('#settings-import-file'),
    settingsClear: $('#settings-clear'),
    settingsRefresh: $('#settings-refresh'),
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
    // Confirm dialog
    confirmDialog: $('#confirm-dialog'),
    confirmDialogTitle: $('#confirm-dialog-title'),
    confirmDialogBody: $('#confirm-dialog-body'),
    confirmDialogCancel: $('#confirm-dialog-cancel'),
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
    const topArea = dom.commandsTop;
    const bottomArea = dom.commandsBottom;
    topArea.innerHTML = '';
    bottomArea.innerHTML = '';
    topArea.dataset.mode = currentMode;
    bottomArea.dataset.mode = currentMode;

    if (currentMode === 'custom') {
        // Custom mode: all buttons in bottom area, no critical split
        topArea.classList.add('hidden');
        const commands = getCustomCommands();
        for (let i = 0; i < commands.length; i++) {
            bottomArea.appendChild(createCommandBtn(commands[i], false, i));
        }
        const addBtn = document.createElement('button');
        addBtn.className = 'add-custom-btn';
        addBtn.textContent = '+ Add Command';
        addBtn.addEventListener('click', () => openCustomDialog(-1));
        bottomArea.appendChild(addBtn);
    } else {
        topArea.classList.remove('hidden');
        const mode = MODES[currentMode];
        const critical = mode?.critical || [];
        const primary = mode?.commands || [];

        // Critical buttons go to the top area (require confirmation unless noConfirm)
        for (const cmd of critical) {
            topArea.appendChild(createCommandBtn(cmd, !cmd.noConfirm));
        }
        // Primary buttons go to the bottom area (easy thumb reach)
        for (const cmd of primary) {
            bottomArea.appendChild(createCommandBtn(cmd, false));
        }
    }
}

let confirmTimers = new Map();

/* ================================================
   Confirm Dialog
   ================================================ */
function openConfirmDialog(title, options) {
    dom.confirmDialogTitle.textContent = title;
    dom.confirmDialogBody.innerHTML = '';
    for (const opt of options) {
        const btn = document.createElement('button');
        btn.className = `confirm-option ${opt.class || ''}`;
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
            closeConfirmDialog();
            if (navigator.vibrate) navigator.vibrate(50);
            opt.onSelect();
        });
        dom.confirmDialogBody.appendChild(btn);
    }
    dom.confirmDialog.classList.add('open');
}

function closeConfirmDialog() {
    dom.confirmDialog.classList.remove('open');
}

function createCommandBtn(cmd, requireConfirm, customIndex) {
    const btn = document.createElement('button');
    btn.className = `cmd-btn ${cmd.class || 'btn-secondary'}`;
    btn.innerHTML = `<span class="icon">${cmd.icon || ''}</span> ${cmd.label}`;

    if (cmd.action === 'switchDesktop') {
        // Special: show desktop choice dialog
        btn.addEventListener('click', () => {
            openConfirmDialog('Switch to Desktop', [
                {
                    label: '1 \u2014 Presentation',
                    class: '',
                    onSelect: () => connection.sendCommand(currentMode, 'switchDesktop1'),
                },
                {
                    label: '2 \u2014 Demo',
                    class: 'secondary',
                    onSelect: () => connection.sendCommand(currentMode, 'switchDesktop2'),
                },
            ]);
        });
    } else if (cmd.action === 'startSlideshow') {
        // Special: show choice dialog
        btn.addEventListener('click', () => {
            openConfirmDialog('Start Slideshow', [
                {
                    label: '▶ From Beginning',
                    class: '',
                    onSelect: () => connection.sendCommand(currentMode, 'startSlideshow'),
                },
                {
                    label: '📍 From Current Slide',
                    class: 'secondary',
                    onSelect: () => connection.sendCommand(currentMode, 'startSlideshowFromCurrent'),
                },
            ]);
        });
    } else if (requireConfirm) {
        btn.addEventListener('click', () => {
            openConfirmDialog(cmd.label, [
                {
                    label: `${cmd.icon || '⚠️'} Yes, ${cmd.label}`,
                    class: cmd.action === 'endSlideshow' ? 'danger' : (cmd.action === 'blackScreen' ? 'dark' : ''),
                    onSelect: () => connection.sendCommand(currentMode, cmd.action),
                },
            ]);
        });
    } else {
        btn.addEventListener('click', () => {
            if (navigator.vibrate) navigator.vibrate(50);
            connection.sendCommand(currentMode, cmd.action);
        });
    }

    // Long-press to edit custom commands
    if (currentMode === 'custom' && customIndex !== undefined) {
        let pressTimer = null;
        btn.addEventListener('pointerdown', () => {
            pressTimer = setTimeout(() => openCustomDialog(customIndex), 500);
        });
        btn.addEventListener('pointerup', () => clearTimeout(pressTimer));
        btn.addEventListener('pointerleave', () => clearTimeout(pressTimer));
    }

    return btn;
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
    dom.settingsConnStr.value = getConnectionString();
    dom.settingsHub.value = getHubName();
    dom.settingsHeartbeat.checked = localStorage.getItem('rc_heartbeat') === '1';
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

function connectWithSettings(connStr, hub) {
    if (!connStr || !connStr.trim()) return;
    connStr = connStr.trim();
    hub = (hub || 'Hub').trim();
    saveConnectionString(connStr);
    saveHubName(hub);
    connection.connect(connStr, hub);
    hideSetup();
}

/* ================================================
   Event Listeners
   ================================================ */
function bindEvents() {
    // Setup screen
    dom.setupConnect.addEventListener('click', () => {
        connectWithSettings(dom.setupConnStr.value, dom.setupHub.value);
    });
    dom.setupConnStr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') connectWithSettings(dom.setupConnStr.value, dom.setupHub.value);
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
        const connStr = dom.settingsConnStr.value.trim();
        const hub = dom.settingsHub.value.trim() || 'Hub';
        if (connStr) {
            connection.disconnect();
            connectWithSettings(connStr, hub);
            closeSettings();
        }
    });

    dom.settingsDisconnect.addEventListener('click', () => {
        connection.disconnect();
    });

    // Heartbeat toggle
    dom.settingsHeartbeat.addEventListener('change', () => {
        const enabled = dom.settingsHeartbeat.checked;
        localStorage.setItem('rc_heartbeat', enabled ? '1' : '0');
        connection.setHeartbeat(enabled);
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
                const cs = getConnectionString();
                if (cs) {
                    connection.disconnect();
                    connection.connect(cs, getHubName());
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
        timer.reset();
        clearAll();
        currentMode = 'powerpoint';
        renderModeTabs();
        renderCommands();
        updateTimerDisplay();
        closeSettings();
    });

    dom.settingsRefresh.addEventListener('click', async () => {
        dom.settingsRefresh.textContent = '⏳ Checking...';
        dom.settingsRefresh.disabled = true;
        try {
            const reg = await navigator.serviceWorker?.getRegistration();
            if (reg) {
                await reg.update();
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    location.reload();
                    return;
                }
            }
            // Also clear caches to force fresh fetch
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
            location.reload();
        } catch {
            location.reload();
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

    // Confirm dialog
    dom.confirmDialogCancel.addEventListener('click', closeConfirmDialog);
    dom.confirmDialog.addEventListener('click', (e) => {
        if (e.target === dom.confirmDialog) closeConfirmDialog();
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
    const storedConnStr = getConnectionString();
    if (storedConnStr) {
        hideSetup();
        // Restore heartbeat setting before connecting
        if (localStorage.getItem('rc_heartbeat') === '1') {
            connection.setHeartbeat(true);
        }
        connection.connect(storedConnStr, getHubName());
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
