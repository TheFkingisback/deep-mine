import type { ServerMessage } from '@shared/messages';
import type { Connection } from './Connection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCallback = (msg: any) => void;

export class MessageHandler {
  private connection: Connection;
  private handlers = new Map<string, AnyCallback[]>();

  constructor(connection: Connection) {
    this.connection = connection;
    this.connection.onMessage = (msg) => this.dispatch(msg);
  }

  on<T extends ServerMessage['type']>(
    type: T,
    callback: (msg: Extract<ServerMessage, { type: T }>) => void
  ): void {
    const list = this.handlers.get(type) ?? [];
    list.push(callback);
    this.handlers.set(type, list);
  }

  off(type: ServerMessage['type'], callback: AnyCallback): void {
    const list = this.handlers.get(type);
    if (!list) return;
    const index = list.indexOf(callback);
    if (index >= 0) list.splice(index, 1);
  }

  private dispatch(msg: ServerMessage): void {
    const list = this.handlers.get(msg.type);
    if (!list || list.length === 0) return;
    for (const handler of list) {
      try {
        handler(msg);
      } catch (err) {
        console.error(`[MessageHandler] Error handling ${msg.type}:`, err);
      }
    }
  }

  destroy(): void {
    this.handlers.clear();
    this.connection.onMessage = null;
  }
}
