import type { ClientMessage, ServerMessage } from '@shared/messages';

export class Connection {
  private ws: WebSocket | null = null;
  private url: string;
  private _isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private autoReconnect = true;

  onMessage: ((msg: ServerMessage) => void) | null = null;
  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;
  // L4: Reconnection feedback callbacks
  onReconnecting: ((attempt: number, maxAttempts: number) => void) | null = null;
  onReconnectFailed: (() => void) | null = null;

  // L8: Message throttling for high-frequency actions
  private lastActionTime = 0;
  private readonly actionThrottleMs = 50;

  constructor(url: string) {
    this.url = url;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): Promise<void> {
    const CONNECT_TIMEOUT_MS = 5000;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.ws) { this.ws.close(); this.ws = null; }
        reject(new Error('Connection timeout'));
      }, CONNECT_TIMEOUT_MS);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this._isConnected = true;
          this.reconnectAttempts = 0;
          if (this.onConnect) this.onConnect();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as ServerMessage;
            if (this.onMessage) this.onMessage(message);
          } catch {
            // Ignore unparseable messages
          }
        };

        this.ws.onclose = () => {
          clearTimeout(timeout);
          this._isConnected = false;
          if (this.onDisconnect) this.onDisconnect();
          if (this.autoReconnect) this.attemptReconnect();
        };

        this.ws.onerror = () => {
          if (!this._isConnected) {
            clearTimeout(timeout);
            reject(new Error('Failed to connect'));
          }
        };
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  disconnect(): void {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this._isConnected = false;
  }

  send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    // L8: Throttle high-frequency messages to reduce wasted bandwidth
    if (message.type === 'move' || message.type === 'dig') {
      const now = Date.now();
      if (now - this.lastActionTime < this.actionThrottleMs) return;
      this.lastActionTime = now;
    }
    this.ws.send(JSON.stringify(message));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // L4: Notify consumer that all reconnection attempts failed
      if (this.onReconnectFailed) this.onReconnectFailed();
      return;
    }

    this.reconnectAttempts++;
    // L4: Notify consumer of reconnection attempt
    if (this.onReconnecting) this.onReconnecting(this.reconnectAttempts, this.maxReconnectAttempts);
    // Exponential backoff with jitter to prevent thundering herd
    const base = Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    const jitter = Math.floor(Math.random() * base * 0.3);
    const delay = base + jitter;

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Will trigger onclose → attemptReconnect again
      });
    }, delay);
  }

  setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
  }
}
