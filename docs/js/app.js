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
    timerFullscreen: $('#timer-fullscreen'),
    timerFullscreenDisplay: $('#timer-fullscreen-display'),
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
    settingsReloadKeyboard: $('#settings-reload-keyboard'),
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
let keyboardSequences = [];         // sequences fetched from receiver for keyboard mode
let currentKeyboardIndex = 0;       // which sequence is highlighted/current
let pendingKeyboardReload = false;  // true when user manually triggered a reload

/* ================================================
   Connection Manager
   ================================================ */
const connection = new ConnectionManager(onStatusChange, onMessage);

function onStatusChange(status) {
    const dot = dom.statusDot;
    dot.className = 'status-dot';
    if (status === 'connected') {
        dot.classList.add('connected');
        connection.sendCommand('keyboard', 'getKeyboardSequences');
    } else if (status === 'connecting') dot.classList.add('connecting');
}

function onMessage(data) {
    // Handle keyboard sequences response from receiver
    if (data.type === 'keyboardSequences' && Array.isArray(data.data)) {
        keyboardSequences = data.data;
        currentKeyboardIndex = 0;
        if (pendingKeyboardReload) {
            pendingKeyboardReload = false;
            const n = keyboardSequences.length;
            showToast(`⌨ Loaded ${n} sequence${n !== 1 ? 's' : ''}`);
        }
        // Re-render if we're currently in keyboard mode
        if (currentMode === 'keyboard') {
            renderCommands();
        }
    }
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
    dom.timerFullscreenDisplay.textContent = display;
    // Sync classes to fullscreen display
    dom.timerFullscreenDisplay.className = 'timer-fullscreen-display';
    dom.timerDisplay.classList.remove('countdown', 'alert');
    if (timer.mode === 'countdown' && timer.isRunning) {
        dom.timerDisplay.classList.add('countdown');
        dom.timerFullscreenDisplay.classList.add('countdown');
        if (timer.getRemainingMs() <= 0) {
            dom.timerDisplay.classList.add('alert');
            dom.timerFullscreenDisplay.classList.add('alert');
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

    if (currentMode === 'keyboard') {
        // Keyboard mode: sequences + nav buttons all in bottom area, top hidden
        topArea.classList.add('hidden');
        const mode = MODES[currentMode];
        const navCmds = mode?.commands || [];

        // Keyboard sequences in bottom area
        if (keyboardSequences.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'placeholder-message';
            placeholder.textContent = 'No sequences available. Check receiver connection.';
            placeholder.style.padding = '20px';
            placeholder.style.textAlign = 'center';
            placeholder.style.color = 'var(--text-secondary)';
            bottomArea.appendChild(placeholder);
        } else {
            for (let i = 0; i < keyboardSequences.length; i++) {
                const seq = keyboardSequences[i];
                const btn = document.createElement('button');
                const seqId = seq.id || seq.Id || '';
                const seqLabel = seq.label || seq.Label || seq.text || seq.Text || '(empty sequence)';
                const seqIcon = seq.icon || seq.Icon || '⌨';
                const isCurrent = i === currentKeyboardIndex;
                const activePill = isCurrent ? '<span class="keyboard-active-pill">ACTIVE</span>' : '';
                btn.className = 'cmd-btn btn-secondary keyboard-seq' + (isCurrent ? ' keyboard-current' : '');
                btn.innerHTML = `<span class="icon">${seqIcon}</span><span class="keyboard-seq-text">${seqLabel}</span>${activePill}`;
                btn.addEventListener('click', () => {
                    currentKeyboardIndex = i;
                    renderCommands();
                });
                btn.addEventListener('dblclick', () => {
                    if (navigator.vibrate) navigator.vibrate(50);
                    currentKeyboardIndex = i;
                    if (seqId) {
                        connection.sendCommand(currentMode, seqId);
                    }
                    renderCommands();
                });
                bottomArea.appendChild(btn);
            }
        }

        // Navigation buttons in explicit order: Previous above Next at the bottom.
        const prevCmd = navCmds.find(c => c.action === 'prevKeyboard');
        const nextCmd = navCmds.find(c => c.action === 'nextKeyboard');

        const buildNavBtn = (cmd, direction) => {
            if (!cmd) return null;
            const btn = document.createElement('button');
            const navClass = direction === 'next' ? 'keyboard-nav-next' : 'keyboard-nav-prev';
            btn.className = `cmd-btn ${cmd.class || 'btn-secondary'} ${navClass}`;
            btn.innerHTML = `<span class="icon">${cmd.icon || ''}</span> ${cmd.label}`;
            btn.addEventListener('click', () => {
                if (keyboardSequences.length === 0) return;
                if (navigator.vibrate) navigator.vibrate(50);
                if (direction === 'next') {
                    currentKeyboardIndex = (currentKeyboardIndex + 1) % keyboardSequences.length;
                } else {
                    currentKeyboardIndex = (currentKeyboardIndex - 1 + keyboardSequences.length) % keyboardSequences.length;
                }
                renderCommands();
            });
            btn.addEventListener('dblclick', () => {
                if (keyboardSequences.length === 0) return;
                if (navigator.vibrate) navigator.vibrate(50);
                const seq = keyboardSequences[currentKeyboardIndex] || {};
                const seqId = seq.id || seq.Id || '';
                if (seqId) {
                    connection.sendCommand(currentMode, seqId);
                }
            });
            return btn;
        };

        const prevBtn = buildNavBtn(prevCmd, 'prev');
        const nextBtn = buildNavBtn(nextCmd, 'next');
        if (prevBtn) bottomArea.appendChild(prevBtn);
        if (nextBtn) bottomArea.appendChild(nextBtn);
    } else if (currentMode === 'custom') {
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
                {
                    label: '3 \u2014 Code',
                    class: 'secondary',
                    onSelect: () => connection.sendCommand(currentMode, 'switchDesktop3'),
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

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    // Trigger reflow so the transition fires
    toast.getBoundingClientRect();
    toast.classList.add('toast-visible');
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 2500);
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
    // Timer display: double-click to fullscreen, single click on overlay to dismiss
    dom.timerDisplay.addEventListener('dblclick', () => {
        dom.timerFullscreen.classList.add('open');
    });
    dom.timerFullscreen.addEventListener('click', () => {
        dom.timerFullscreen.classList.remove('open');
    });

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

    dom.settingsReloadKeyboard.addEventListener('click', () => {
        pendingKeyboardReload = true;
        connection.sendCommand('keyboard', 'getKeyboardSequences');
        closeSettings();
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
