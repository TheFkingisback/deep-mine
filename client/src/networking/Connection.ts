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

  constructor(url: string) {
    this.url = url;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this._isConnected = true;
          this.reconnectAttempts = 0;
          console.log('[Connection] Connected to server');
          if (this.onConnect) this.onConnect();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as ServerMessage;
            if (this.onMessage) this.onMessage(message);
          } catch (err) {
            console.error('[Connection] Failed to parse message:', err);
          }
        };

        this.ws.onclose = () => {
          this._isConnected = false;
          console.log('[Connection] Disconnected from server');
          if (this.onDisconnect) this.onDisconnect();
          if (this.autoReconnect) this.attemptReconnect();
        };

        this.ws.onerror = (err) => {
          console.error('[Connection] WebSocket error:', err);
          if (!this._isConnected) {
            reject(new Error('Failed to connect'));
          }
        };
      } catch (err) {
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
      console.warn('[Connection] Cannot send, not connected');
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Connection] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff: 2s, 4s, 8s, 16s... capped at 30s
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[Connection] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

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
