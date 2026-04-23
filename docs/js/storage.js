export const StorageKeys = {
    CONNECTION_STRING: 'rc_connection_string',
    HUB_NAME: 'rc_hub_name',
    TIMER_STATE: 'rc_timer_state',
    SELECTED_MODE: 'rc_selected_mode',
    CUSTOM_COMMANDS: 'rc_custom_commands',
    TIMER_PREFS: 'rc_timer_prefs',
    KEYBOARD_SEQUENCES: 'rc_keyboard_sequences',
};

export function saveConnectionString(connStr) {
    localStorage.setItem(StorageKeys.CONNECTION_STRING, connStr);
}

export function getConnectionString() {
    return localStorage.getItem(StorageKeys.CONNECTION_STRING) || '';
}

export function saveHubName(hub) {
    localStorage.setItem(StorageKeys.HUB_NAME, hub);
}

export function getHubName() {
    return localStorage.getItem(StorageKeys.HUB_NAME) || 'Hub';
}

export function saveSelectedMode(mode) {
    localStorage.setItem(StorageKeys.SELECTED_MODE, mode);
}

export function getSelectedMode() {
    return localStorage.getItem(StorageKeys.SELECTED_MODE) || 'powerpoint';
}

export function exportConfig() {
    const config = {};
    for (const key of Object.values(StorageKeys)) {
        const value = localStorage.getItem(key);
        if (value !== null) {
            config[key] = value;
        }
    }
    return JSON.stringify(config, null, 2);
}

export function importConfig(json) {
    const config = JSON.parse(json);
    for (const [key, value] of Object.entries(config)) {
        if (Object.values(StorageKeys).includes(key)) {
            localStorage.setItem(key, value);
        }
    }
}

export function downloadConfigFile() {
    const json = exportConfig();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'remote-control-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function clearAll() {
    const connStr = localStorage.getItem(StorageKeys.CONNECTION_STRING);
    const hub = localStorage.getItem(StorageKeys.HUB_NAME);
    for (const key of Object.values(StorageKeys)) {
        localStorage.removeItem(key);
    }
    if (connStr) localStorage.setItem(StorageKeys.CONNECTION_STRING, connStr);
    if (hub) localStorage.setItem(StorageKeys.HUB_NAME, hub);
}
