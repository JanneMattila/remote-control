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
            { action: 'volumeUp', label: 'Vol +', icon: '🔊', class: 'btn-secondary' },
            { action: 'volumeDown', label: 'Vol −', icon: '🔉', class: 'btn-secondary' },
            { action: 'mute', label: 'Mute', icon: '🔇', class: 'btn-secondary' },
            { action: 'fullscreen', label: 'Fullscreen', icon: '⛶', class: 'btn-accent' },
        ]
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
