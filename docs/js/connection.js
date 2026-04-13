const SUBPROTOCOL = 'json.webpubsub.azure.v1';
const GROUP_NAME = 'remote';
const MAX_BACKOFF = 30000;
const HEARTBEAT_INTERVAL = 10000;
const TOKEN_LIFETIME_MS = 55 * 60 * 1000; // refresh before 1h expiry

/**
 * Parse an Azure Web PubSub connection string.
 * Format: Endpoint=https://...;AccessKey=...;Version=1.0;
 */
function parseConnectionString(connStr) {
    const parts = {};
    const segments = connStr.split(';');
    console.log('[Parse] Raw input length:', connStr.length, '| Segments:', segments.length);
    for (const segment of segments) {
        if (!segment.trim()) continue;
        const idx = segment.indexOf('=');
        if (idx > 0) {
            const key = segment.substring(0, idx).trim();
            const value = segment.substring(idx + 1).trim();
            parts[key] = value;
            console.log(`[Parse] ${key}: length=${value.length} first4="${value.substring(0,4)}" last4="${value.slice(-4)}"`);
        }
    }
    if (!parts.Endpoint || !parts.AccessKey) {
        throw new Error('Invalid connection string. Must contain Endpoint and AccessKey.');
    }
    return { endpoint: parts.Endpoint.replace(/\/$/, ''), accessKey: parts.AccessKey };
}

function base64url(data) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateClientAccessUrl(endpoint, accessKey, hubName) {
    const wsEndpoint = endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
    const audience = `${endpoint}/client/hubs/${hubName}`;
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;

    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({
        role: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup'],
        nbf: now, exp, iat: now, aud: audience,
    }));

    const signingInput = `${header}.${payload}`;
    // Azure SDK uses UTF-8 bytes of the key STRING (not base64-decoded)
    const keyData = new TextEncoder().encode(accessKey);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = new Uint8Array(
        await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(signingInput))
    );
    return `${wsEndpoint}/client/hubs/${hubName}?access_token=${signingInput}.${base64url(signature)}`;
}

export class ConnectionManager {
    #ws = null;
    #endpoint = '';
    #accessKey = '';
    #hubName = 'Hub';
    #onStatusChange;
    #onMessage;
    #reconnectAttempts = 0;
    #reconnectTimer = null;
    #heartbeatTimer = null;
    #tokenRefreshTimer = null;
    #status = 'disconnected';
    #intentionalClose = false;
    #ackId = 0;
    #lastReceiverHeartbeat = null;
    #heartbeatEnabled = false;

    constructor(onStatusChange, onMessage) {
        this.#onStatusChange = onStatusChange;
        this.#onMessage = onMessage;
    }

    get isConnected() {
        return this.#ws !== null && this.#ws.readyState === WebSocket.OPEN;
    }

    get status() {
        return this.#status;
    }

    get receiverActive() {
        if (!this.#lastReceiverHeartbeat) return false;
        return (Date.now() - this.#lastReceiverHeartbeat) < 30000;
    }

    get lastReceiverSeen() {
        return this.#lastReceiverHeartbeat;
    }

    setHeartbeat(enabled) {
        this.#heartbeatEnabled = enabled;
        if (enabled && this.isConnected) {
            this.#startHeartbeat();
        } else {
            this.#stopHeartbeat();
        }
    }

    get heartbeatEnabled() {
        return this.#heartbeatEnabled;
    }

    async connect(connStr, hubName) {
        if (!connStr) return;
        this.#hubName = hubName || 'Hub';
        this.#intentionalClose = false;
        this.#clearReconnect();

        try {
            const parsed = parseConnectionString(connStr);
            this.#endpoint = parsed.endpoint;
            this.#accessKey = parsed.accessKey;
        } catch (e) {
            this.#setStatus('error');
            console.error('Connection string parse error:', e.message);
            return;
        }

        await this.#openSocket();
    }

    disconnect() {
        this.#intentionalClose = true;
        this.#clearReconnect();
        this.#stopHeartbeat();
        this.#stopTokenRefresh();
        if (this.#ws) {
            this.#ws.close();
            this.#ws = null;
        }
        this.#lastReceiverHeartbeat = null;
        this.#setStatus('disconnected');
    }

    sendCommand(mode, action) {
        if (!this.isConnected) return false;
        try {
            this.#ws.send(JSON.stringify({
                type: 'sendToGroup', group: GROUP_NAME, dataType: 'json',
                data: { type: 'command', mode, action, timestamp: new Date().toISOString() },
                ackId: ++this.#ackId,
            }));
            return true;
        } catch {
            return false;
        }
    }

    async #openSocket() {
        this.#setStatus('connecting');
        let url;
        try {
            url = await generateClientAccessUrl(this.#endpoint, this.#accessKey, this.#hubName);
        } catch (e) {
            this.#setStatus('error');
            this.#scheduleReconnect();
            return;
        }

        try {
            this.#ws = new WebSocket(url, SUBPROTOCOL);
        } catch {
            this.#setStatus('error');
            this.#scheduleReconnect();
            return;
        }

        this.#ws.onopen = () => { this.#reconnectAttempts = 0; };

        this.#ws.onmessage = (event) => {
            let msg;
            try { msg = JSON.parse(event.data); } catch { return; }
            this.#handleProtocolMessage(msg);
        };

        this.#ws.onclose = () => {
            this.#ws = null;
            if (!this.#intentionalClose) {
                this.#setStatus('disconnected');
                this.#scheduleReconnect();
            }
        };

        this.#ws.onerror = () => {};
    }

    #handleProtocolMessage(msg) {
        switch (msg.type) {
            case 'system':
                if (msg.event === 'connected') {
                    this.#joinGroup();
                    this.#setStatus('connected');
                    this.#scheduleTokenRefresh();
                    if (this.#heartbeatEnabled) this.#startHeartbeat();
                }
                break;
            case 'ack':
                if (!msg.success) console.warn('PubSub ack error:', msg.error);
                break;
            case 'message':
                if (msg.data) {
                    if (msg.data.type === 'heartbeat' && msg.data.source === 'receiver') {
                        this.#lastReceiverHeartbeat = Date.now();
                    }
                    this.#onMessage?.(msg.data);
                }
                break;
        }
    }

    #joinGroup() {
        if (!this.isConnected) return;
        this.#ws.send(JSON.stringify({ type: 'joinGroup', group: GROUP_NAME, ackId: ++this.#ackId }));
    }

    #setStatus(status) {
        if (this.#status === status) return;
        this.#status = status;
        this.#onStatusChange(status);
    }

    // Reconnect with fresh token before current one expires
    #scheduleTokenRefresh() {
        this.#stopTokenRefresh();
        this.#tokenRefreshTimer = setTimeout(async () => {
            if (this.isConnected && !this.#intentionalClose) {
                this.#ws?.close();
                await this.#openSocket();
            }
        }, TOKEN_LIFETIME_MS);
    }

    #stopTokenRefresh() {
        if (this.#tokenRefreshTimer) { clearTimeout(this.#tokenRefreshTimer); this.#tokenRefreshTimer = null; }
    }

    #startHeartbeat() {
        this.#stopHeartbeat();
        this.#sendHeartbeat();
        this.#heartbeatTimer = setInterval(() => this.#sendHeartbeat(), HEARTBEAT_INTERVAL);
    }

    #stopHeartbeat() {
        if (this.#heartbeatTimer) { clearInterval(this.#heartbeatTimer); this.#heartbeatTimer = null; }
    }

    #sendHeartbeat() {
        if (!this.isConnected) return;
        try {
            this.#ws.send(JSON.stringify({
                type: 'sendToGroup', group: GROUP_NAME, dataType: 'json',
                data: { type: 'heartbeat', source: 'remote', timestamp: new Date().toISOString() },
                ackId: ++this.#ackId,
            }));
        } catch { /* best-effort */ }
    }

    #scheduleReconnect() {
        if (this.#intentionalClose) return;
        const delay = Math.min(1000 * Math.pow(2, this.#reconnectAttempts), MAX_BACKOFF);
        this.#reconnectAttempts++;
        this.#reconnectTimer = setTimeout(() => this.#openSocket(), delay);
    }

    #clearReconnect() {
        if (this.#reconnectTimer) { clearTimeout(this.#reconnectTimer); this.#reconnectTimer = null; }
    }
}
