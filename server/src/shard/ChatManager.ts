import { ServerMessage, ChatBroadcastMessage } from '../types.js';

const MAX_MESSAGE_LENGTH = 200;
const RATE_LIMIT_MS = 2000; // 1 message per 2 seconds

/**
 * Handles chat messages with rate limiting and content sanitization.
 */
export class ChatManager {
  private lastMessageTime = new Map<string, number>();

  processMessage(
    playerId: string,
    displayName: string,
    rawMessage: string
  ): { broadcast: ServerMessage | null; error: ServerMessage | null } {
    // Rate limiting
    const now = Date.now();
    const lastTime = this.lastMessageTime.get(playerId) ?? 0;
    if (now - lastTime < RATE_LIMIT_MS) {
      return {
        broadcast: null,
        error: {
          type: 'error',
          code: 'CHAT_RATE_LIMIT',
          message: 'You are sending messages too fast',
        },
      };
    }

    // Validate message length
    if (rawMessage.length === 0) {
      return { broadcast: null, error: null };
    }

    // Truncate if too long
    const sanitized = rawMessage.slice(0, MAX_MESSAGE_LENGTH).trim();
    if (sanitized.length === 0) {
      return { broadcast: null, error: null };
    }

    this.lastMessageTime.set(playerId, now);

    const broadcast: ChatBroadcastMessage = {
      type: 'chat_message',
      playerId,
      displayName,
      message: sanitized,
      timestamp: now,
    };

    return { broadcast, error: null };
  }

  removePlayer(playerId: string): void {
    this.lastMessageTime.delete(playerId);
  }

  destroy(): void {
    this.lastMessageTime.clear();
  }
}
