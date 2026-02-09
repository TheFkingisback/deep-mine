import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Connection } from '../../networking/Connection';
import type { MatchmakingResultMessage } from '@shared/messages';

type LobbyMode = 'menu' | 'joining' | 'waiting_room';

export class LobbyScene {
  private app: Application;
  private container: Container;
  private connection: Connection;

  private mode: LobbyMode = 'menu';
  private roomCode: string | null = null;
  private roomCodeInput = '';

  // UI elements
  private background!: Graphics;
  private titleText!: Text;
  private statusText!: Text;
  private roomCodeText: Text | null = null;
  private buttons: Container[] = [];
  private inputDisplay: Text | null = null;
  private inputContainer: Container | null = null;

  // Callbacks
  private onMatchFound: ((shardId: string, roomCode?: string) => void) | null = null;

  // Keyboard handler reference
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(app: Application, connection: Connection) {
    this.app = app;
    this.connection = connection;
    this.container = new Container();
    this.app.stage.addChild(this.container);
  }

  async init(): Promise<void> {
    this.drawBackground();
    this.drawTitle();
    this.drawStatusText();
    this.drawMenuButtons();

    // Listen for matchmaking results
    this.connection.onMessage = (msg) => {
      if (msg.type === 'matchmaking_result') {
        this.handleMatchmakingResult(msg as MatchmakingResultMessage);
      }
    };
  }

  setMatchFoundCallback(cb: (shardId: string, roomCode?: string) => void): void {
    this.onMatchFound = cb;
  }

  private drawBackground(): void {
    this.background = new Graphics();
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    // Dark gradient background
    this.background.rect(0, 0, w, h);
    this.background.fill({ color: 0x1a1a2e });

    // Decorative mine-themed border
    this.background.rect(0, 0, w, 4);
    this.background.fill({ color: 0xf0a500 });
    this.background.rect(0, h - 4, w, 4);
    this.background.fill({ color: 0xf0a500 });

    this.container.addChild(this.background);
  }

  private drawTitle(): void {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 48,
      fontWeight: 'bold',
      fill: '#F0A500',
      dropShadow: { color: '#000000', blur: 4, angle: Math.PI / 4, distance: 3 },
    });
    this.titleText = new Text({ text: 'DEEP MINE', style });
    this.titleText.anchor.set(0.5, 0);
    this.titleText.x = this.app.screen.width / 2;
    this.titleText.y = 40;
    this.container.addChild(this.titleText);

    // Subtitle
    const subStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fill: '#AAAACC',
    });
    const subtitle = new Text({ text: 'Cooperative Mining Adventure', style: subStyle });
    subtitle.anchor.set(0.5, 0);
    subtitle.x = this.app.screen.width / 2;
    subtitle.y = 100;
    this.container.addChild(subtitle);
  }

  private drawStatusText(): void {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fill: '#88FF88',
    });
    this.statusText = new Text({ text: '', style });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.x = this.app.screen.width / 2;
    this.statusText.y = this.app.screen.height - 50;
    this.container.addChild(this.statusText);
  }

  private drawMenuButtons(): void {
    this.clearButtons();
    const cx = this.app.screen.width / 2;
    const startY = 180;
    const gap = 70;

    this.createButton('Quick Play', cx, startY, 260, 50, 0x2d6a4f, () => {
      this.onQuickPlay();
    });
    this.createButton('Create Party', cx, startY + gap, 260, 50, 0x1d3557, () => {
      this.onCreateParty();
    });
    this.createButton('Join Party', cx, startY + gap * 2, 260, 50, 0x6d3a7d, () => {
      this.showJoinInput();
    });
    this.createButton('Play Solo', cx, startY + gap * 3, 260, 50, 0x5c4033, () => {
      this.onPlaySolo();
    });
  }

  private createButton(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    onClick: () => void
  ): void {
    const btn = new Container();
    btn.x = x;
    btn.y = y;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 8);
    bg.fill({ color });
    bg.roundRect(-w / 2, -h / 2, w, h, 8);
    bg.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
    btn.addChild(bg);

    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: '#FFFFFF',
    });
    const text = new Text({ text: label, style });
    text.anchor.set(0.5, 0.5);
    btn.addChild(text);

    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => { bg.alpha = 0.8; });
    btn.on('pointerout', () => { bg.alpha = 1; });

    this.container.addChild(btn);
    this.buttons.push(btn);
  }

  private clearButtons(): void {
    for (const btn of this.buttons) {
      this.container.removeChild(btn);
      btn.destroy({ children: true });
    }
    this.buttons = [];
  }

  private showJoinInput(): void {
    this.clearButtons();
    this.roomCodeInput = '';
    this.mode = 'joining';

    const cx = this.app.screen.width / 2;
    const y = 220;

    // Instruction
    const instrStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fill: '#CCCCEE',
    });
    const instrContainer = new Container();
    const instr = new Text({ text: 'Enter Room Code:', style: instrStyle });
    instr.anchor.set(0.5, 0.5);
    instrContainer.addChild(instr);
    instrContainer.x = cx;
    instrContainer.y = y;
    this.container.addChild(instrContainer);
    this.buttons.push(instrContainer);

    // Input display box
    this.inputContainer = new Container();
    this.inputContainer.x = cx;
    this.inputContainer.y = y + 50;

    const inputBg = new Graphics();
    inputBg.roundRect(-120, -20, 240, 40, 4);
    inputBg.fill({ color: 0x222244 });
    inputBg.roundRect(-120, -20, 240, 40, 4);
    inputBg.stroke({ color: 0xf0a500, width: 2 });
    this.inputContainer.addChild(inputBg);

    const inputStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#F0A500',
      letterSpacing: 8,
    });
    this.inputDisplay = new Text({ text: '______', style: inputStyle });
    this.inputDisplay.anchor.set(0.5, 0.5);
    this.inputContainer.addChild(this.inputDisplay);

    this.container.addChild(this.inputContainer);
    this.buttons.push(this.inputContainer);

    // Join button
    this.createButton('Join', cx, y + 120, 160, 44, 0x6d3a7d, () => {
      if (this.roomCodeInput.length >= 4) {
        this.onJoinParty(this.roomCodeInput);
      }
    });

    // Back button
    this.createButton('Back', cx, y + 180, 160, 44, 0x555555, () => {
      this.removeKeyHandler();
      this.mode = 'menu';
      this.drawMenuButtons();
    });

    // Keyboard listener for code input
    this.keyHandler = (e: KeyboardEvent) => {
      if (this.mode !== 'joining') return;
      if (e.key === 'Backspace') {
        this.roomCodeInput = this.roomCodeInput.slice(0, -1);
      } else if (e.key === 'Enter' && this.roomCodeInput.length >= 4) {
        this.onJoinParty(this.roomCodeInput);
        return;
      } else if (/^[A-Za-z0-9]$/.test(e.key) && this.roomCodeInput.length < 6) {
        this.roomCodeInput += e.key.toUpperCase();
      }
      this.updateInputDisplay();
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private updateInputDisplay(): void {
    if (!this.inputDisplay) return;
    const padded = this.roomCodeInput.padEnd(6, '_');
    this.inputDisplay.text = padded;
  }

  private removeKeyHandler(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  private showWaitingRoom(roomCode: string): void {
    this.clearButtons();
    this.removeKeyHandler();
    this.mode = 'waiting_room';
    this.roomCode = roomCode;

    const cx = this.app.screen.width / 2;

    // Room code display
    const codeStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 36,
      fontWeight: 'bold',
      fill: '#F0A500',
      letterSpacing: 10,
    });
    this.roomCodeText = new Text({ text: roomCode, style: codeStyle });
    this.roomCodeText.anchor.set(0.5, 0.5);
    this.roomCodeText.x = cx;
    this.roomCodeText.y = 220;

    const labelStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fill: '#AAAACC',
    });
    const labelContainer = new Container();
    const label = new Text({ text: 'Share this code with friends:', style: labelStyle });
    label.anchor.set(0.5, 0.5);
    labelContainer.addChild(label);
    labelContainer.x = cx;
    labelContainer.y = 185;

    this.container.addChild(labelContainer);
    this.container.addChild(this.roomCodeText);
    this.buttons.push(labelContainer);

    this.statusText.text = 'Waiting for players...';
  }

  private setStatus(text: string, color = '#88FF88'): void {
    this.statusText.text = text;
    this.statusText.style.fill = color;
  }

  // --- Matchmaking actions ---

  private onQuickPlay(): void {
    this.setStatus('Finding a game...', '#FFFF88');
    this.connection.send({ type: 'join_quick_play' });
  }

  private onCreateParty(): void {
    this.setStatus('Creating party...', '#FFFF88');
    this.connection.send({ type: 'create_party' });
  }

  private onJoinParty(code: string): void {
    this.removeKeyHandler();
    this.setStatus(`Joining room ${code}...`, '#FFFF88');
    this.connection.send({ type: 'join_party', roomCode: code });
  }

  private onPlaySolo(): void {
    this.setStatus('Starting solo session...', '#FFFF88');
    this.connection.send({ type: 'play_solo' });
  }

  private handleMatchmakingResult(msg: MatchmakingResultMessage): void {
    if (msg.success && msg.shardId) {
      this.setStatus('Match found!', '#88FF88');
      if (this.onMatchFound) {
        this.onMatchFound(msg.shardId, msg.roomCode);
      }
    } else {
      this.setStatus(msg.error ?? 'Matchmaking failed', '#FF8888');
      // Return to menu after a delay
      setTimeout(() => {
        this.mode = 'menu';
        this.drawMenuButtons();
        this.setStatus('');
      }, 2000);
    }

    // If we got a room code back (from create party), show waiting room
    if (msg.success && msg.roomCode && !this.onMatchFound) {
      this.showWaitingRoom(msg.roomCode);
    }
  }

  update(_delta: number): void {
    // Animate title glow or similar effects could go here
  }

  destroy(): void {
    this.removeKeyHandler();
    this.clearButtons();
    if (this.roomCodeText) {
      this.container.removeChild(this.roomCodeText);
      this.roomCodeText.destroy();
      this.roomCodeText = null;
    }
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
