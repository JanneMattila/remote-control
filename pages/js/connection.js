const SUBPROTOCOL = 'json.webpubsub.azure.v1';
const GROUP_NAME = 'remote';
const MAX_BACKOFF = 30000;

export class ConnectionManager {
    #ws = null;
    #url = '';
    #onStatusChange;
    #onMessage;
    #reconnectAttempts = 0;
    #reconnectTimer = null;
    #status = 'disconnected';
    #intentionalClose = false;
    #ackId = 0;

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
        if (this.#ws) {
            this.#ws.close();
            this.#ws = null;
        }
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
                }
                break;

            case 'ack':
                if (!msg.success) {
                    console.warn('PubSub ack error:', msg.error);
                }
                break;

            case 'message':
                if (this.#onMessage && msg.data) {
                    this.#onMessage(msg.data);
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

    #clearReconnect() {
        if (this.#reconnectTimer) {
            clearTimeout(this.#reconnectTimer);
            this.#reconnectTimer = null;
        }
    }
}
