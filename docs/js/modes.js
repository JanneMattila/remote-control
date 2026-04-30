import { StorageKeys } from './storage.js';

export const MODES = {
    powerpoint: {
        name: 'PowerPoint',
        icon: '📊',
        commands: [
            { action: 'nextSlide', label: 'Next Slide', icon: '▶', class: 'btn-primary btn-hero' },
        ],
        critical: [
            { action: 'startSlideshow', label: 'Start Slideshow', icon: '🎬', class: 'btn-accent' },
            { action: 'endSlideshow', label: 'End Slideshow', icon: '⏹', class: 'btn-accent' },
            { action: 'blackScreen', label: 'Black Screen', icon: '⬛', class: 'btn-dark' },
            { action: 'switchDesktop', label: 'Switch Desktop', icon: '🖥', class: 'btn-accent' },
            { action: 'prevSlide', label: '◀ Previous Slide', icon: '', class: 'btn-secondary', noConfirm: true },
        ]
    },
    watch: {
        name: 'Watch',
        icon: '🎬',
        commands: [
            { action: 'playPause', label: 'Play / Pause', icon: '⏯', class: 'btn-primary btn-large' },
            { action: 'skipBack', label: 'Skip Back', icon: '⏪', class: 'btn-secondary btn-large' },
            { action: 'skipForward', label: 'Skip Forward', icon: '⏩', class: 'btn-secondary btn-large' },
        ],
        critical: [
            { action: 'volumeUp', label: 'Vol +', icon: '🔊', class: 'btn-secondary', noConfirm: true },
            { action: 'volumeDown', label: 'Vol −', icon: '🔉', class: 'btn-secondary', noConfirm: true },
            { action: 'mute', label: 'Mute', icon: '🔇', class: 'btn-secondary', noConfirm: true },
            { action: 'fullscreen', label: 'Fullscreen', icon: '⛶', class: 'btn-accent btn-wide', noConfirm: true },
        ]
    },
    keyboard: {
        name: 'Keyboard',
        icon: '⌨',
        commands: [
            { action: 'nextKeyboard', label: 'Next', icon: '▶', class: 'btn-primary btn-large' },
            { action: 'prevKeyboard', label: 'Previous', icon: '◀', class: 'btn-secondary btn-large' },
        ],
        critical: []
    }
};

export function getCustomCommands() {
    const stored = localStorage.getItem(StorageKeys.CUSTOM_COMMANDS);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

export function saveCustomCommands(commands) {
    localStorage.setItem(StorageKeys.CUSTOM_COMMANDS, JSON.stringify(commands));
}

export function addCustomCommand(label, action, icon = '🔘') {
    const commands = getCustomCommands();
    commands.push({ label, action, icon, class: 'btn-secondary' });
    saveCustomCommands(commands);
    return commands;
}

export function removeCustomCommand(index) {
    const commands = getCustomCommands();
    commands.splice(index, 1);
    saveCustomCommands(commands);
    return commands;
}

export function editCustomCommand(index, label, action, icon) {
    const commands = getCustomCommands();
    if (index >= 0 && index < commands.length) {
        commands[index] = { ...commands[index], label, action, icon };
        saveCustomCommands(commands);
    }
    return commands;
}

export function getKeyboardSequences() {
    const stored = localStorage.getItem(StorageKeys.KEYBOARD_SEQUENCES);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

export function saveKeyboardSequences(sequences) {
    localStorage.setItem(StorageKeys.KEYBOARD_SEQUENCES, JSON.stringify(sequences));
}

export function addKeyboardSequence(text) {
    const sequences = getKeyboardSequences();
    sequences.push(text);
    saveKeyboardSequences(sequences);
    return sequences;
}

export function removeKeyboardSequence(index) {
    const sequences = getKeyboardSequences();
    sequences.splice(index, 1);
    saveKeyboardSequences(sequences);
    return sequences;
}
