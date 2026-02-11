import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Connection } from '../../networking/Connection';
import { MessageHandler } from '../../networking/MessageHandler';
import type { MatchJoinedMessage, MatchListMessage } from '@shared/messages';

type LobbyMode = 'name_input' | 'menu' | 'joining' | 'match_list';

export class LobbyScene {
  private app: Application;
  private container: Container;
  private connection: Connection;
  private messageHandler: MessageHandler;

  private mode: LobbyMode = 'name_input';
  private roomCodeInput = '';
  private nameInput = '';

  private background!: Graphics;
  private titleText!: Text;
  private statusText!: Text;
  private buttons: Container[] = [];
  private inputDisplay: Text | null = null;
  private inputContainer: Container | null = null;

  private onMatchFound: ((data: MatchJoinedMessage) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(app: Application, connection: Connection, messageHandler: MessageHandler) {
    this.app = app;
    this.connection = connection;
    this.messageHandler = messageHandler;
    this.container = new Container();
    this.app.stage.addChild(this.container);
  }

  async init(): Promise<void> {
    this.drawBackground();
    this.drawLogo();
    this.drawTitle();
    this.drawStatusText();
    this.showNameInput();

    this.messageHandler.on('match_joined', (msg) => {
      this.setStatus('Match found!', '#88FF88');
      if (this.onMatchFound) this.onMatchFound(msg);
    });

    this.messageHandler.on('match_list', (msg) => {
      this.showMatchList(msg);
    });
  }

  setMatchFoundCallback(cb: (data: MatchJoinedMessage) => void): void {
    this.onMatchFound = cb;
  }

  private drawBackground(): void {
    this.background = new Graphics();
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.background.rect(0, 0, w, h);
    this.background.fill({ color: 0x1a1a2e });
    this.background.rect(0, 0, w, 4);
    this.background.fill({ color: 0xf0a500 });
    this.background.rect(0, h - 4, w, 4);
    this.background.fill({ color: 0xf0a500 });
    this.container.addChild(this.background);
  }

  private drawLogo(): void {
    const cx = this.app.screen.width / 2;
    const cy = 55;
    const r = 38;
    const logo = new Graphics();

    // Orange circle badge
    logo.circle(cx, cy, r);
    logo.fill({ color: 0xff9f1c });
    logo.circle(cx, cy, r);
    logo.stroke({ color: 0xc46600, width: 3 });

    // Pickaxe handle (diagonal line - dark outline)
    logo.moveTo(cx - 10, cy + 14);
    logo.lineTo(cx + 18, cy - 16);
    logo.stroke({ color: 0x5a3010, width: 6 });
    // Pickaxe handle (lighter inner)
    logo.moveTo(cx - 10, cy + 14);
    logo.lineTo(cx + 18, cy - 16);
    logo.stroke({ color: 0x8B5A2B, width: 4 });

    // Pickaxe head (metal tip) - using moveTo/lineTo path
    logo.moveTo(cx + 16, cy - 18);
    logo.lineTo(cx + 26, cy - 26);
    logo.lineTo(cx + 28, cy - 14);
    logo.lineTo(cx + 21, cy - 12);
    logo.closePath();
    logo.fill({ color: 0xd0d8e0 });
    logo.moveTo(cx + 16, cy - 18);
    logo.lineTo(cx + 26, cy - 26);
    logo.lineTo(cx + 28, cy - 14);
    logo.lineTo(cx + 21, cy - 12);
    logo.closePath();
    logo.stroke({ color: 0x8899aa, width: 1 });

    // Gem (pentagon shape, bottom-left) - using moveTo/lineTo path
    logo.moveTo(cx - 14, cy + 2);
    logo.lineTo(cx - 6, cy + 6);
    logo.lineTo(cx - 8, cy + 16);
    logo.lineTo(cx - 18, cy + 16);
    logo.lineTo(cx - 20, cy + 6);
    logo.closePath();
    logo.fill({ color: 0xff6600 });
    logo.moveTo(cx - 14, cy + 2);
    logo.lineTo(cx - 6, cy + 6);
    logo.lineTo(cx - 8, cy + 16);
    logo.lineTo(cx - 18, cy + 16);
    logo.lineTo(cx - 20, cy + 6);
    logo.closePath();
    logo.stroke({ color: 0xcc5500, width: 1 });

    // Gem highlight
    logo.circle(cx - 16, cy + 7, 2);
    logo.fill({ color: 0xffffff, alpha: 0.5 });

    this.container.addChild(logo);
  }

  private drawTitle(): void {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif', fontSize: 48, fontWeight: 'bold', fill: '#F0A500',
      dropShadow: { color: '#000000', blur: 4, angle: Math.PI / 4, distance: 3 },
    });
    this.titleText = new Text({ text: 'DEEP MINE', style });
    this.titleText.anchor.set(0.5, 0);
    this.titleText.x = this.app.screen.width / 2;
    this.titleText.y = 100;
    this.container.addChild(this.titleText);

    const subStyle = new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 18, fill: '#AAAACC' });
    const subtitle = new Text({ text: 'Cooperative Mining Adventure', style: subStyle });
    subtitle.anchor.set(0.5, 0);
    subtitle.x = this.app.screen.width / 2;
    subtitle.y = 155;
    this.container.addChild(subtitle);
  }

  private drawStatusText(): void {
    const style = new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 16, fill: '#88FF88' });
    this.statusText = new Text({ text: '', style });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.x = this.app.screen.width / 2;
    this.statusText.y = this.app.screen.height - 50;
    this.container.addChild(this.statusText);
  }

  // ─── Name Input Screen ───────────────────────────────────────────

  private showNameInput(): void {
    this.clearButtons();
    this.removeKeyHandler();
    this.nameInput = '';
    this.mode = 'name_input';
    const cx = this.app.screen.width / 2;
    const y = 200;

    const instrContainer = new Container();
    const instr = new Text({ text: 'Choose your name:', style: new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 20, fill: '#CCCCEE' }) });
    instr.anchor.set(0.5, 0.5);
    instrContainer.addChild(instr);
    instrContainer.x = cx; instrContainer.y = y;
    this.container.addChild(instrContainer);
    this.buttons.push(instrContainer);

    this.inputContainer = new Container();
    this.inputContainer.x = cx; this.inputContainer.y = y + 55;
    const inputBg = new Graphics();
    inputBg.roundRect(-140, -22, 280, 44, 6);
    inputBg.fill({ color: 0x222244 });
    inputBg.roundRect(-140, -22, 280, 44, 6);
    inputBg.stroke({ color: 0xf0a500, width: 2 });
    this.inputContainer.addChild(inputBg);

    this.inputDisplay = new Text({ text: '________________', style: new TextStyle({ fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold', fill: '#F0A500', letterSpacing: 4 }) });
    this.inputDisplay.anchor.set(0.5, 0.5);
    this.inputContainer.addChild(this.inputDisplay);
    this.container.addChild(this.inputContainer);
    this.buttons.push(this.inputContainer);

    this.createButton('Confirm', cx, y + 130, 200, 50, 0x2d6a4f, () => {
      this.confirmName();
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.mode !== 'name_input') return;
      if (e.key === 'Backspace') {
        this.nameInput = this.nameInput.slice(0, -1);
      } else if (e.key === 'Enter') {
        this.confirmName();
        return;
      } else if (/^[A-Za-z0-9_\- ]$/.test(e.key) && this.nameInput.length < 16) {
        this.nameInput += e.key;
      }
      if (this.inputDisplay) {
        this.inputDisplay.text = this.nameInput || '________________';
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private confirmName(): void {
    const name = this.nameInput.trim();
    if (name.length === 0) {
      this.setStatus('Please enter a name!', '#FF6666');
      return;
    }
    this.connection.send({ type: 'set_name', name });
    this.removeKeyHandler();
    this.setStatus('');
    this.drawMenuButtons();
  }

  // ─── Menu ────────────────────────────────────────────────────────

  private drawMenuButtons(): void {
    this.clearButtons();
    this.mode = 'menu';
    const cx = this.app.screen.width / 2;
    const startY = 200;
    const gap = 70;

    this.createButton('Quick Play', cx, startY, 260, 50, 0x2d6a4f, () => {
      this.setStatus('Finding a game...', '#FFFF88');
      this.connection.send({ type: 'join_quick_play' });
    });
    this.createButton('Create Match', cx, startY + gap, 260, 50, 0x1d3557, () => {
      this.setStatus('Creating match...', '#FFFF88');
      this.connection.send({ type: 'create_match', matchName: `Match_${Date.now().toString(36).slice(-4).toUpperCase()}` });
    });
    this.createButton('Browse Matches', cx, startY + gap * 2, 260, 50, 0x6d3a7d, () => {
      this.setStatus('Loading...', '#FFFF88');
      this.connection.send({ type: 'list_matches' });
    });
    this.createButton('Join by Code', cx, startY + gap * 3, 260, 50, 0x5c4033, () => {
      this.showJoinInput();
    });
    this.createButton('Play Solo', cx, startY + gap * 4, 260, 50, 0x444444, () => {
      this.setStatus('Starting solo...', '#FFFF88');
      this.connection.send({ type: 'play_solo' });
    });
  }

  private createButton(label: string, x: number, y: number, w: number, h: number, color: number, onClick: () => void): void {
    const btn = new Container();
    btn.x = x; btn.y = y;
    btn.eventMode = 'static'; btn.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 8);
    bg.fill({ color });
    bg.roundRect(-w / 2, -h / 2, w, h, 8);
    bg.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
    btn.addChild(bg);

    const style = new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 20, fontWeight: 'bold', fill: '#FFFFFF' });
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

  // ─── Join by Code ────────────────────────────────────────────────

  private showJoinInput(): void {
    this.clearButtons();
    this.removeKeyHandler();
    this.roomCodeInput = '';
    this.mode = 'joining';
    const cx = this.app.screen.width / 2;
    const y = 220;

    const instrContainer = new Container();
    const instr = new Text({ text: 'Enter Match Code:', style: new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 18, fill: '#CCCCEE' }) });
    instr.anchor.set(0.5, 0.5);
    instrContainer.addChild(instr);
    instrContainer.x = cx; instrContainer.y = y;
    this.container.addChild(instrContainer);
    this.buttons.push(instrContainer);

    this.inputContainer = new Container();
    this.inputContainer.x = cx; this.inputContainer.y = y + 50;
    const inputBg = new Graphics();
    inputBg.roundRect(-120, -20, 240, 40, 4);
    inputBg.fill({ color: 0x222244 });
    inputBg.roundRect(-120, -20, 240, 40, 4);
    inputBg.stroke({ color: 0xf0a500, width: 2 });
    this.inputContainer.addChild(inputBg);

    this.inputDisplay = new Text({ text: '________', style: new TextStyle({ fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold', fill: '#F0A500', letterSpacing: 8 }) });
    this.inputDisplay.anchor.set(0.5, 0.5);
    this.inputContainer.addChild(this.inputDisplay);
    this.container.addChild(this.inputContainer);
    this.buttons.push(this.inputContainer);

    this.createButton('Join', cx, y + 120, 160, 44, 0x6d3a7d, () => {
      if (this.roomCodeInput.length >= 4) {
        this.setStatus(`Joining ${this.roomCodeInput}...`, '#FFFF88');
        this.connection.send({ type: 'join_match', matchId: this.roomCodeInput });
      }
    });
    this.createButton('Back', cx, y + 180, 160, 44, 0x555555, () => {
      this.removeKeyHandler();
      this.drawMenuButtons();
      this.setStatus('');
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.mode !== 'joining') return;
      if (e.key === 'Backspace') this.roomCodeInput = this.roomCodeInput.slice(0, -1);
      else if (e.key === 'Enter' && this.roomCodeInput.length >= 4) {
        this.setStatus(`Joining ${this.roomCodeInput}...`, '#FFFF88');
        this.connection.send({ type: 'join_match', matchId: this.roomCodeInput });
        return;
      } else if (/^[A-Za-z0-9]$/.test(e.key) && this.roomCodeInput.length < 8) {
        this.roomCodeInput += e.key.toUpperCase();
      }
      if (this.inputDisplay) this.inputDisplay.text = this.roomCodeInput.padEnd(8, '_');
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private removeKeyHandler(): void {
    if (this.keyHandler) { window.removeEventListener('keydown', this.keyHandler); this.keyHandler = null; }
  }

  // ─── Match List ──────────────────────────────────────────────────

  private showMatchList(msg: MatchListMessage): void {
    this.clearButtons();
    this.removeKeyHandler();
    this.mode = 'match_list';
    this.setStatus('');
    const cx = this.app.screen.width / 2;
    let y = 200;

    if (msg.matches.length === 0) {
      const c = new Container();
      const t = new Text({ text: 'No matches available. Create one!', style: new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 18, fill: '#AAAAAA' }) });
      t.anchor.set(0.5, 0.5);
      c.addChild(t); c.x = cx; c.y = y;
      this.container.addChild(c);
      this.buttons.push(c);
      y += 60;
    } else {
      for (const m of msg.matches.slice(0, 5)) {
        this.createButton(`${m.matchName} (${m.playerCount}/${m.maxPlayers})`, cx, y, 320, 44, 0x2d6a4f, () => {
          this.setStatus(`Joining ${m.matchName}...`, '#FFFF88');
          this.connection.send({ type: 'join_match', matchId: m.matchId });
        });
        y += 55;
      }
    }

    this.createButton('Back', cx, y + 20, 160, 44, 0x555555, () => {
      this.drawMenuButtons();
      this.setStatus('');
    });
  }

  private setStatus(text: string, color = '#88FF88'): void {
    this.statusText.text = text;
    this.statusText.style.fill = color;
  }

  update(_delta: number): void {}

  destroy(): void {
    this.removeKeyHandler();
    this.clearButtons();
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
