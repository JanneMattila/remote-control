import { StorageKeys } from './storage.js';

export class Timer {
    #onTick;
    #onAlert;
    #intervalId = null;
    #mode = 'idle';          // 'idle' | 'stopwatch' | 'countdown'
    #running = false;
    #startTimestamp = null;   // Date.now() when started/resumed
    #accumulated = 0;         // ms accumulated before pause
    #countdownDuration = 0;   // total countdown ms

    constructor(onTick, onAlert) {
        this.#onTick = onTick;
        this.#onAlert = onAlert;
    }

    get mode() {
        return this.#mode;
    }

    get isRunning() {
        return this.#running;
    }

    startStopwatch() {
        this.reset();
        this.#mode = 'stopwatch';
        this.#startTimestamp = Date.now();
        this.#running = true;
        this.#startTicking();
        this.saveState();
    }

    startCountdown(durationMs) {
        this.reset();
        this.#mode = 'countdown';
        this.#countdownDuration = durationMs;
        this.#startTimestamp = Date.now();
        this.#running = true;
        this.#startTicking();
        this.saveState();
    }

    pause() {
        if (!this.#running) return;
        this.#accumulated += Date.now() - this.#startTimestamp;
        this.#startTimestamp = null;
        this.#running = false;
        this.#stopTicking();
        this.saveState();
    }

    resume() {
        if (this.#running || this.#mode === 'idle') return;
        this.#startTimestamp = Date.now();
        this.#running = true;
        this.#startTicking();
        this.saveState();
    }

    reset() {
        this.#stopTicking();
        this.#mode = 'idle';
        this.#running = false;
        this.#startTimestamp = null;
        this.#accumulated = 0;
        this.#countdownDuration = 0;
        this.saveState();
    }

    getElapsedMs() {
        let elapsed = this.#accumulated;
        if (this.#running && this.#startTimestamp) {
            elapsed += Date.now() - this.#startTimestamp;
        }
        return elapsed;
    }

    getRemainingMs() {
        if (this.#mode !== 'countdown') return 0;
        return Math.max(0, this.#countdownDuration - this.getElapsedMs());
    }

    getDisplayMs() {
        if (this.#mode === 'countdown') {
            return this.getRemainingMs();
        }
        return this.getElapsedMs();
    }

    getDisplay() {
        const ms = this.getDisplayMs();
        return Timer.formatMs(ms);
    }

    static formatMs(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const mm = String(minutes).padStart(2, '0');
        const ss = String(seconds).padStart(2, '0');

        if (hours > 0) {
            const hh = String(hours).padStart(2, '0');
            return `${hh}:${mm}:${ss}`;
        }
        return `${mm}:${ss}`;
    }

    saveState() {
        const state = {
            mode: this.#mode,
            running: this.#running,
            startTimestamp: this.#startTimestamp,
            accumulated: this.#accumulated,
            countdownDuration: this.#countdownDuration,
        };
        localStorage.setItem(StorageKeys.TIMER_STATE, JSON.stringify(state));
    }

    restoreState() {
        const raw = localStorage.getItem(StorageKeys.TIMER_STATE);
        if (!raw) return;

        try {
            const state = JSON.parse(raw);
            this.#mode = state.mode || 'idle';
            this.#accumulated = state.accumulated || 0;
            this.#countdownDuration = state.countdownDuration || 0;

            if (state.running && state.startTimestamp) {
                // Timer was running — account for elapsed time while away
                this.#startTimestamp = state.startTimestamp;
                this.#running = true;

                // Check if countdown already finished
                if (this.#mode === 'countdown' && this.getRemainingMs() <= 0) {
                    this.#running = false;
                    this.#accumulated = this.#countdownDuration;
                    this.#startTimestamp = null;
                    this.#onAlert?.();
                } else {
                    this.#startTicking();
                }
            } else {
                this.#running = false;
                this.#startTimestamp = null;
            }
        } catch {
            // Corrupted state, ignore
        }
    }

    #startTicking() {
        this.#stopTicking();
        this.#intervalId = setInterval(() => this.#tick(), 1000);
    }

    #stopTicking() {
        if (this.#intervalId !== null) {
            clearInterval(this.#intervalId);
            this.#intervalId = null;
        }
    }

    #tick() {
        this.#onTick?.(this.getDisplay());

        if (this.#mode === 'countdown' && this.getRemainingMs() <= 0) {
            this.pause();
            this.#accumulated = this.#countdownDuration;
            this.#onAlert?.();
        }
    }
}
