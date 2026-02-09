import { Container, Graphics, Text, TextStyle } from 'pixi.js';

interface ChatMessage {
  playerId: string;
  displayName: string;
  message: string;
  timestamp: number;
}

const MAX_VISIBLE_MESSAGES = 8;
const MESSAGE_FADE_MS = 10000; // Messages fade after 10 seconds
const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 200;
const LINE_HEIGHT = 20;

/**
 * In-game chat panel with message display and input.
 * Press Enter to toggle input, type message, press Enter to send.
 */
export class ChatPanel {
  private container: Container;
  private background: Graphics;
  private messages: ChatMessage[] = [];
  private messageTexts: Text[] = [];
  private inputActive = false;
  private inputText = '';
  private inputDisplay: Text | null = null;
  private inputBg: Graphics | null = null;

  private onSendMessage: ((message: string) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private screenWidth: number;
  private screenHeight: number;

  constructor(parentContainer: Container, screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.container = new Container();
    this.container.x = 10;
    this.container.y = screenHeight - PANEL_HEIGHT - 50;

    // Semi-transparent background
    this.background = new Graphics();
    this.background.roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 4);
    this.background.fill({ color: 0x000000, alpha: 0.3 });
    this.container.addChild(this.background);

    // Input area
    this.inputBg = new Graphics();
    this.inputBg.roundRect(0, PANEL_HEIGHT + 4, PANEL_WIDTH, 24, 4);
    this.inputBg.fill({ color: 0x000000, alpha: 0.5 });
    this.inputBg.visible = false;
    this.container.addChild(this.inputBg);

    const inputStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fill: '#FFFFFF',
    });
    this.inputDisplay = new Text({ text: '', style: inputStyle });
    this.inputDisplay.x = 4;
    this.inputDisplay.y = PANEL_HEIGHT + 8;
    this.inputDisplay.visible = false;
    this.container.addChild(this.inputDisplay);

    parentContainer.addChild(this.container);

    this.setupKeyboardInput();
  }

  setSendCallback(cb: (message: string) => void): void {
    this.onSendMessage = cb;
  }

  addMessage(playerId: string, displayName: string, message: string): void {
    this.messages.push({
      playerId,
      displayName,
      message,
      timestamp: Date.now(),
    });

    // Keep max messages
    if (this.messages.length > 50) {
      this.messages.shift();
    }

    this.refreshDisplay();
  }

  addSystemMessage(message: string): void {
    this.addMessage('system', 'System', message);
  }

  private refreshDisplay(): void {
    // Remove old text objects
    for (const t of this.messageTexts) {
      this.container.removeChild(t);
      t.destroy();
    }
    this.messageTexts = [];

    // Show recent messages
    const recent = this.messages.slice(-MAX_VISIBLE_MESSAGES);
    const startY = PANEL_HEIGHT - recent.length * LINE_HEIGHT - 4;

    for (let i = 0; i < recent.length; i++) {
      const msg = recent[i];
      const age = Date.now() - msg.timestamp;
      const alpha = this.inputActive ? 0.9 : Math.max(0, 1 - age / MESSAGE_FADE_MS);

      if (alpha <= 0) continue;

      const isSystem = msg.playerId === 'system';
      const color = isSystem ? '#FFFF88' : '#88CCFF';
      const prefix = isSystem ? '' : `${msg.displayName}: `;

      const style = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 12,
        fill: color,
        wordWrap: true,
        wordWrapWidth: PANEL_WIDTH - 8,
      });

      const text = new Text({ text: `${prefix}${msg.message}`, style });
      text.x = 4;
      text.y = startY + i * LINE_HEIGHT;
      text.alpha = alpha;
      this.container.addChild(text);
      this.messageTexts.push(text);
    }
  }

  private setupKeyboardInput(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (this.inputActive) {
          // Send message
          if (this.inputText.trim().length > 0 && this.onSendMessage) {
            this.onSendMessage(this.inputText.trim());
          }
          this.inputText = '';
          this.inputActive = false;
          this.updateInputDisplay();
        } else {
          // Open input
          this.inputActive = true;
          this.updateInputDisplay();
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (!this.inputActive) return;

      if (e.key === 'Escape') {
        this.inputActive = false;
        this.inputText = '';
        this.updateInputDisplay();
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === 'Backspace') {
        this.inputText = this.inputText.slice(0, -1);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key.length === 1 && this.inputText.length < 200) {
        this.inputText += e.key;
        e.preventDefault();
        e.stopPropagation();
      }

      this.updateInputDisplay();
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  private updateInputDisplay(): void {
    if (this.inputBg) {
      this.inputBg.visible = this.inputActive;
    }
    if (this.inputDisplay) {
      this.inputDisplay.visible = this.inputActive;
      this.inputDisplay.text = this.inputActive ? `> ${this.inputText}_` : '';
    }

    // Also update background visibility
    this.background.alpha = this.inputActive ? 1 : 0.3;
    this.refreshDisplay();
  }

  isInputActive(): boolean {
    return this.inputActive;
  }

  update(_deltaMs: number): void {
    // Fade old messages periodically
    if (!this.inputActive) {
      this.refreshDisplay();
    }
  }

  destroy(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    for (const t of this.messageTexts) {
      t.destroy();
    }
    this.messageTexts = [];
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
