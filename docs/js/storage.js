export const StorageKeys = {
    CONNECTION_URL: 'rc_connection_url',
    TIMER_STATE: 'rc_timer_state',
    SELECTED_MODE: 'rc_selected_mode',
    CUSTOM_COMMANDS: 'rc_custom_commands',
    TIMER_PREFS: 'rc_timer_prefs',
};

export function saveConnectionUrl(url) {
    localStorage.setItem(StorageKeys.CONNECTION_URL, url);
}

export function getConnectionUrl() {
    return localStorage.getItem(StorageKeys.CONNECTION_URL) || '';
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
    const connectionUrl = localStorage.getItem(StorageKeys.CONNECTION_URL);
    for (const key of Object.values(StorageKeys)) {
        localStorage.removeItem(key);
    }
    if (connectionUrl) {
        localStorage.setItem(StorageKeys.CONNECTION_URL, connectionUrl);
    }
}
