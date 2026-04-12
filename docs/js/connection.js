const SUBPROTOCOL = 'json.webpubsub.azure.v1';
const GROUP_NAME = 'remote';
const MAX_BACKOFF = 30000;
const HEARTBEAT_INTERVAL = 10000;

export class ConnectionManager {
    #ws = null;
    #url = '';
    #onStatusChange;
    #onMessage;
    #reconnectAttempts = 0;
    #reconnectTimer = null;
    #heartbeatTimer = null;
    #status = 'disconnected';
    #intentionalClose = false;
    #ackId = 0;
    #lastReceiverHeartbeat = null;

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

    /** Returns true if a receiver heartbeat was seen within the last 30 seconds. */
    get receiverActive() {
        if (!this.#lastReceiverHeartbeat) return false;
        return (Date.now() - this.#lastReceiverHeartbeat) < 30000;
    }

    /** Returns the timestamp of the last receiver heartbeat, or null. */
    get lastReceiverSeen() {
        return this.#lastReceiverHeartbeat;
    }

    connect(url) {
        if (!url) return;
        this.#url = url;
        this.#intentionalClose = false;
        this.#clearReconnect();
        this.#openSocket();
    }

    disconnect() {
        this.#intentionalClose = true;
        this.#clearReconnect();
        this.#stopHeartbeat();
        if (this.#ws) {
            this.#ws.close();
            this.#ws = null;
        }
        this.#lastReceiverHeartbeat = null;
        this.#setStatus('disconnected');
    }

    sendCommand(mode, action) {
        if (!this.isConnected) return false;

        const message = {
            type: 'sendToGroup',
            group: GROUP_NAME,
            dataType: 'json',
            data: {
                type: 'command',
                mode,
                action,
                timestamp: new Date().toISOString(),
            },
            ackId: ++this.#ackId,
        };

        try {
            this.#ws.send(JSON.stringify(message));
            return true;
        } catch {
            return false;
        }
    }

    #openSocket() {
        this.#setStatus('connecting');

        try {
            this.#ws = new WebSocket(this.#url, SUBPROTOCOL);
        } catch {
            this.#setStatus('error');
            this.#scheduleReconnect();
            return;
        }

        this.#ws.onopen = () => {
            this.#reconnectAttempts = 0;
            // Wait for the 'connected' system event before joining
        };

        this.#ws.onmessage = (event) => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch {
                return;
            }
            this.#handleProtocolMessage(msg);
        };

        this.#ws.onclose = () => {
            this.#ws = null;
            if (!this.#intentionalClose) {
                this.#setStatus('disconnected');
                this.#scheduleReconnect();
            }
        };

        this.#ws.onerror = () => {
            // onclose fires after onerror, reconnect handled there
        };
    }

    #handleProtocolMessage(msg) {
        switch (msg.type) {
            case 'system':
                if (msg.event === 'connected') {
                    this.#joinGroup();
                    this.#setStatus('connected');
                    this.#startHeartbeat();
                }
                break;

            case 'ack':
                if (!msg.success) {
                    console.warn('PubSub ack error:', msg.error);
                }
                break;

            case 'message':
                if (msg.data) {
                    // Track receiver heartbeats
                    if (msg.data.type === 'heartbeat' && msg.data.source === 'receiver') {
                        this.#lastReceiverHeartbeat = Date.now();
                    }
                    if (this.#onMessage) {
                        this.#onMessage(msg.data);
                    }
                }
                break;
        }
    }

    #joinGroup() {
        if (!this.isConnected) return;
        const joinMsg = {
            type: 'joinGroup',
            group: GROUP_NAME,
            ackId: ++this.#ackId,
        };
        this.#ws.send(JSON.stringify(joinMsg));
    }

    #setStatus(status) {
        if (this.#status === status) return;
        this.#status = status;
        this.#onStatusChange(status);
    }

    #scheduleReconnect() {
        if (this.#intentionalClose) return;
        const delay = Math.min(1000 * Math.pow(2, this.#reconnectAttempts), MAX_BACKOFF);
        this.#reconnectAttempts++;
        this.#reconnectTimer = setTimeout(() => this.#openSocket(), delay);
    }

    #startHeartbeat() {
        this.#stopHeartbeat();
        this.#sendHeartbeat();
        this.#heartbeatTimer = setInterval(() => this.#sendHeartbeat(), HEARTBEAT_INTERVAL);
    }

    #stopHeartbeat() {
        if (this.#heartbeatTimer) {
            clearInterval(this.#heartbeatTimer);
            this.#heartbeatTimer = null;
        }
    }

    #sendHeartbeat() {
        if (!this.isConnected) return;
        try {
            this.#ws.send(JSON.stringify({
                type: 'sendToGroup',
                group: GROUP_NAME,
                dataType: 'json',
                data: { type: 'heartbeat', source: 'remote', timestamp: new Date().toISOString() },
                ackId: ++this.#ackId,
            }));
        } catch { /* best-effort */ }
    }

    #clearReconnect() {
        if (this.#reconnectTimer) {
            clearTimeout(this.#reconnectTimer);
            this.#reconnectTimer = null;
        }
    }
}
