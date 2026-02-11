import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Connection } from '../../networking/Connection';
import { MessageHandler } from '../../networking/MessageHandler';
import { SessionManager } from '../../networking/SessionManager';
import * as AuthClient from '../../networking/AuthClient';
import type { MatchJoinedMessage, MatchListMessage } from '@shared/messages';

type LobbyMode = 'login' | 'register' | 'forgot' | 'menu' | 'joining' | 'match_list';

const sessionManager = new SessionManager();

// ─── Design Tokens (Apple-inspired) ────────────────────────────────
const COLORS = {
  bgTop: 0x0f0c1a,
  bgBottom: 0x1a1333,
  card: 0x1e1a2e,
  cardBorder: 0x3a3455,
  inputBg: 0x16132a,
  inputBorder: 0x2e2a44,
  inputBorderActive: 0xf0a500,
  accent: 0xf0a500,
  accentDark: 0xd08e00,
  textPrimary: 0xffffff,
  textSecondary: 0x9e97b8,
  textMuted: 0x6b6580,
  link: 0x8b9cf7,
  linkHover: 0xb0bdff,
  success: 0x34d399,
  error: 0xf87171,
  warning: 0xfbbf24,
  btnDanger: 0x444460,
};

const RADIUS = { card: 20, input: 12, button: 14 };
const CARD_WIDTH = 380;
const INPUT_WIDTH = CARD_WIDTH - 60;
const INPUT_HEIGHT = 44;
const BTN_HEIGHT = 48;

export class LobbyScene {
  private app: Application;
  private container: Container;
  private connection: Connection;
  private messageHandler: MessageHandler;

  private mode: LobbyMode = 'login';
  private roomCodeInput = '';

  private bgLayer!: Graphics;
  private cardContainer!: Container;
  private cardBg!: Graphics;
  private statusText!: Text;
  private uiElements: Container[] = [];
  private inputDisplays: Map<string, { text: Text; bg: Graphics; placeholder: Text }> = new Map();

  private onMatchFound: ((data: MatchJoinedMessage) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  // Form fields
  private fields: { name: string; value: string; label: string; isPassword?: boolean; placeholder?: string }[] = [];
  private activeFieldIndex = 0;

  constructor(app: Application, connection: Connection, messageHandler: MessageHandler) {
    this.app = app;
    this.connection = connection;
    this.messageHandler = messageHandler;
    this.container = new Container();
    this.app.stage.addChild(this.container);
  }

  async init(): Promise<void> {
    this.drawBackground();
    this.createCardContainer();
    this.drawStatusText();

    if (sessionManager.isLoggedIn()) {
      const token = sessionManager.getToken();
      if (token) this.connection.send({ type: 'auth', token });
      this.showMenu();
    } else {
      this.showLoginScreen();
    }

    this.messageHandler.on('match_joined', (msg) => {
      this.setStatus('Match found!', COLORS.success);
      if (this.onMatchFound) this.onMatchFound(msg);
    });

    this.messageHandler.on('match_list', (msg) => {
      this.showMatchList(msg);
    });
  }

  setMatchFoundCallback(cb: (data: MatchJoinedMessage) => void): void {
    this.onMatchFound = cb;
  }

  // ─── Background ───────────────────────────────────────────────────

  private drawBackground(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.bgLayer = new Graphics();

    // Gradient-like background (top to bottom via layered rects)
    const steps = 32;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = this.lerp((COLORS.bgTop >> 16) & 0xff, (COLORS.bgBottom >> 16) & 0xff, t);
      const g = this.lerp((COLORS.bgTop >> 8) & 0xff, (COLORS.bgBottom >> 8) & 0xff, t);
      const b = this.lerp(COLORS.bgTop & 0xff, COLORS.bgBottom & 0xff, t);
      const color = (r << 16) | (g << 8) | b;
      const sy = Math.floor((i / steps) * h);
      const sh = Math.ceil(h / steps) + 1;
      this.bgLayer.rect(0, sy, w, sh);
      this.bgLayer.fill({ color });
    }

    // Subtle radial glow at top center
    const glowR = 300;
    this.bgLayer.circle(w / 2, 0, glowR);
    this.bgLayer.fill({ color: 0x2a1f44, alpha: 0.3 });

    this.container.addChild(this.bgLayer);
  }

  private lerp(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
  }

  // ─── Card Container ───────────────────────────────────────────────

  private createCardContainer(): void {
    this.cardContainer = new Container();
    this.cardContainer.x = this.app.screen.width / 2;
    this.cardContainer.y = 0; // will be positioned per screen
    this.container.addChild(this.cardContainer);

    this.cardBg = new Graphics();
    this.cardContainer.addChild(this.cardBg);
  }

  private drawCard(height: number, yOffset = 80): void {
    this.cardBg.clear();
    const x = -CARD_WIDTH / 2;
    const y = 0;

    // Card shadow
    this.cardBg.roundRect(x + 4, y + 4, CARD_WIDTH, height, RADIUS.card);
    this.cardBg.fill({ color: 0x000000, alpha: 0.25 });

    // Card background
    this.cardBg.roundRect(x, y, CARD_WIDTH, height, RADIUS.card);
    this.cardBg.fill({ color: COLORS.card, alpha: 0.92 });

    // Card border (subtle)
    this.cardBg.roundRect(x, y, CARD_WIDTH, height, RADIUS.card);
    this.cardBg.stroke({ color: COLORS.cardBorder, width: 1, alpha: 0.5 });

    // Top accent line
    this.cardBg.roundRect(x + CARD_WIDTH / 2 - 40, y, 80, 3, 2);
    this.cardBg.fill({ color: COLORS.accent, alpha: 0.8 });

    this.cardContainer.y = yOffset;
  }

  // ─── Drawing Primitives ───────────────────────────────────────────

  private addCardTitle(text: string, y: number): Text {
    const style = new TextStyle({
      fontFamily: "'Fredoka', 'SF Pro Display', -apple-system, sans-serif",
      fontSize: 28,
      fontWeight: '700',
      fill: '#ffffff',
      letterSpacing: 1,
    });
    const t = new Text({ text, style });
    t.anchor.set(0.5, 0);
    t.y = y;
    this.cardContainer.addChild(t);
    this.uiElements.push(t as unknown as Container);
    return t;
  }

  private addCardSubtitle(text: string, y: number): Text {
    const style = new TextStyle({
      fontFamily: "'Fredoka', 'SF Pro Display', -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: '600',
      fill: `#${COLORS.textSecondary.toString(16).padStart(6, '0')}`,
      letterSpacing: 0.5,
    });
    const t = new Text({ text, style });
    t.anchor.set(0.5, 0);
    t.y = y;
    this.cardContainer.addChild(t);
    this.uiElements.push(t as unknown as Container);
    return t;
  }

  private createInputField(label: string, fieldName: string, y: number, placeholder = ''): number {
    const startY = y;

    // Label
    const labelStyle = new TextStyle({
      fontFamily: "'Fredoka', 'SF Pro Display', -apple-system, sans-serif",
      fontSize: 13,
      fontWeight: '600',
      fill: `#${COLORS.textSecondary.toString(16).padStart(6, '0')}`,
      letterSpacing: 0.8,
    });
    const labelText = new Text({ text: label.toUpperCase(), style: labelStyle });
    labelText.x = -INPUT_WIDTH / 2;
    labelText.y = startY;
    this.cardContainer.addChild(labelText);
    this.uiElements.push(labelText as unknown as Container);

    // Input background
    const fieldContainer = new Container();
    fieldContainer.y = startY + 20;
    const bg = new Graphics();
    this.drawInputBg(bg, false);
    fieldContainer.addChild(bg);

    // Placeholder
    const placeholderText = new Text({
      text: placeholder,
      style: new TextStyle({
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 15,
        fill: `#${COLORS.textMuted.toString(16).padStart(6, '0')}`,
      }),
    });
    placeholderText.anchor.set(0, 0.5);
    placeholderText.x = -INPUT_WIDTH / 2 + 16;
    placeholderText.y = INPUT_HEIGHT / 2;
    fieldContainer.addChild(placeholderText);

    // Value text
    const display = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 15,
        fill: '#ffffff',
      }),
    });
    display.anchor.set(0, 0.5);
    display.x = -INPUT_WIDTH / 2 + 16;
    display.y = INPUT_HEIGHT / 2;
    fieldContainer.addChild(display);

    this.inputDisplays.set(fieldName, { text: display, bg, placeholder: placeholderText });

    // Click to focus
    fieldContainer.eventMode = 'static';
    fieldContainer.cursor = 'text';
    fieldContainer.hitArea = { contains: (px: number, py: number) => px >= -INPUT_WIDTH / 2 && px <= INPUT_WIDTH / 2 && py >= 0 && py <= INPUT_HEIGHT };
    fieldContainer.on('pointerdown', () => {
      this.activeFieldIndex = this.fields.findIndex(f => f.name === fieldName);
      this.updateFieldHighlights();
    });

    this.cardContainer.addChild(fieldContainer);
    this.uiElements.push(fieldContainer);

    return startY + 20 + INPUT_HEIGHT + 12; // next Y position
  }

  private drawInputBg(bg: Graphics, active: boolean): void {
    bg.clear();
    const x = -INPUT_WIDTH / 2;
    bg.roundRect(x, 0, INPUT_WIDTH, INPUT_HEIGHT, RADIUS.input);
    bg.fill({ color: COLORS.inputBg });
    bg.roundRect(x, 0, INPUT_WIDTH, INPUT_HEIGHT, RADIUS.input);
    bg.stroke({
      color: active ? COLORS.inputBorderActive : COLORS.inputBorder,
      width: active ? 2 : 1,
      alpha: active ? 1 : 0.6,
    });
  }

  private updateFieldHighlights(): void {
    for (let i = 0; i < this.fields.length; i++) {
      const field = this.fields[i];
      const entry = this.inputDisplays.get(field.name);
      if (!entry) continue;

      const isActive = i === this.activeFieldIndex;
      const rawText = field.isPassword ? '\u2022'.repeat(field.value.length) : field.value;
      entry.text.text = rawText;
      entry.placeholder.visible = field.value.length === 0;
      this.drawInputBg(entry.bg, isActive);
    }
  }

  private createPrimaryButton(label: string, y: number, onClick: () => void): number {
    const btn = new Container();
    btn.y = y;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    // Button shadow
    bg.roundRect(-INPUT_WIDTH / 2 + 2, 3, INPUT_WIDTH, BTN_HEIGHT, RADIUS.button);
    bg.fill({ color: 0x000000, alpha: 0.2 });
    // Button fill (gold gradient simulated)
    bg.roundRect(-INPUT_WIDTH / 2, 0, INPUT_WIDTH, BTN_HEIGHT, RADIUS.button);
    bg.fill({ color: COLORS.accent });
    // Highlight line at top
    bg.roundRect(-INPUT_WIDTH / 2 + 2, 2, INPUT_WIDTH - 4, BTN_HEIGHT / 2 - 2, RADIUS.button);
    bg.fill({ color: 0xffc040, alpha: 0.25 });
    btn.addChild(bg);

    const style = new TextStyle({
      fontFamily: "'Fredoka', 'SF Pro Display', -apple-system, sans-serif",
      fontSize: 17,
      fontWeight: '700',
      fill: '#1a1229',
      letterSpacing: 1,
    });
    const text = new Text({ text: label, style });
    text.anchor.set(0.5, 0.5);
    text.y = BTN_HEIGHT / 2;
    btn.addChild(text);

    btn.hitArea = { contains: (px: number, py: number) => px >= -INPUT_WIDTH / 2 && px <= INPUT_WIDTH / 2 && py >= 0 && py <= BTN_HEIGHT };
    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => { btn.alpha = 0.9; });
    btn.on('pointerout', () => { btn.alpha = 1; });

    this.cardContainer.addChild(btn);
    this.uiElements.push(btn);
    return y + BTN_HEIGHT + 12;
  }

  private createSecondaryButton(label: string, y: number, w: number, color: number, onClick: () => void): Container {
    const btn = new Container();
    btn.y = y;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(-w / 2, 0, w, 46, RADIUS.button);
    bg.fill({ color, alpha: 0.6 });
    bg.roundRect(-w / 2, 0, w, 46, RADIUS.button);
    bg.stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
    btn.addChild(bg);

    const style = new TextStyle({
      fontFamily: "'Fredoka', 'SF Pro Display', -apple-system, sans-serif",
      fontSize: 16,
      fontWeight: '600',
      fill: '#ffffff',
    });
    const text = new Text({ text: label, style });
    text.anchor.set(0.5, 0.5);
    text.y = 23;
    btn.addChild(text);

    btn.hitArea = { contains: (px: number, py: number) => px >= -w / 2 && px <= w / 2 && py >= 0 && py <= 46 };
    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => { btn.alpha = 0.85; });
    btn.on('pointerout', () => { btn.alpha = 1; });

    this.cardContainer.addChild(btn);
    this.uiElements.push(btn);
    return btn;
  }

  private createTextLink(text: string, y: number, onClick: () => void): number {
    const style = new TextStyle({
      fontFamily: "'Fredoka', 'SF Pro Display', -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: '600',
      fill: `#${COLORS.link.toString(16).padStart(6, '0')}`,
    });
    const t = new Text({ text, style });
    t.anchor.set(0.5, 0);
    t.y = y;
    t.eventMode = 'static';
    t.cursor = 'pointer';
    t.on('pointerdown', onClick);
    t.on('pointerover', () => { t.style.fill = `#${COLORS.linkHover.toString(16).padStart(6, '0')}`; });
    t.on('pointerout', () => { t.style.fill = `#${COLORS.link.toString(16).padStart(6, '0')}`; });
    this.cardContainer.addChild(t);
    this.uiElements.push(t as unknown as Container);
    return y + 24;
  }

  private addDivider(y: number): number {
    const g = new Graphics();
    g.moveTo(-INPUT_WIDTH / 2, y);
    g.lineTo(INPUT_WIDTH / 2, y);
    g.stroke({ color: COLORS.cardBorder, width: 1, alpha: 0.4 });
    this.cardContainer.addChild(g);
    this.uiElements.push(g as unknown as Container);
    return y + 16;
  }

  // ─── Form Key Handler ─────────────────────────────────────────────

  private setupFormKeyHandler(onSubmit: () => void): void {
    this.removeKeyHandler();
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.activeFieldIndex = (this.activeFieldIndex + (e.shiftKey ? -1 : 1) + this.fields.length) % this.fields.length;
        this.updateFieldHighlights();
        return;
      }
      if (e.key === 'Enter') { onSubmit(); return; }

      const field = this.fields[this.activeFieldIndex];
      if (!field) return;

      if (e.key === 'Backspace') {
        field.value = field.value.slice(0, -1);
      } else if (e.key.length === 1 && field.value.length < 50) {
        field.value += e.key;
      }
      this.updateFieldHighlights();
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  // ─── Login Screen ─────────────────────────────────────────────────

  private showLoginScreen(): void {
    this.clearUI();
    this.mode = 'login';

    const cardH = 370;
    this.drawCard(cardH, this.app.screen.height / 2 - cardH / 2 - 20);

    let y = 30;
    this.addCardTitle('Welcome Back', y);
    y += 36;
    this.addCardSubtitle('Sign in to continue your adventure', y);
    y += 40;

    this.fields = [
      { name: 'email', value: '', label: 'Email', placeholder: 'you@email.com' },
      { name: 'password', value: '', label: 'Password', isPassword: true, placeholder: 'Your password' },
    ];
    this.activeFieldIndex = 0;

    y = this.createInputField('Email', 'email', y, 'you@email.com');
    y = this.createInputField('Password', 'password', y, 'Your password');
    y += 4;

    y = this.createPrimaryButton('Sign In', y, () => this.handleLogin());
    y += 4;

    this.createTextLink('Create an Account', y, () => this.showRegisterScreen());
    y += 28;
    this.createTextLink('Forgot Password?', y, () => this.showForgotScreen());

    this.setupFormKeyHandler(() => this.handleLogin());
    this.updateFieldHighlights();
  }

  private async handleLogin(): Promise<void> {
    const email = this.fields.find(f => f.name === 'email')?.value ?? '';
    const password = this.fields.find(f => f.name === 'password')?.value ?? '';

    if (!email || !password) {
      this.setStatus('Please fill in all fields', COLORS.error);
      return;
    }

    this.setStatus('Signing in...', COLORS.warning);
    const result = await AuthClient.login(email, password);

    if (result.success && result.token && result.nickname) {
      sessionManager.saveAuth(result.token, result.nickname);
      this.connection.send({ type: 'auth', token: result.token });
      this.setStatus(`Welcome back, ${result.nickname}!`, COLORS.success);
      setTimeout(() => this.showMenu(), 600);
    } else {
      this.setStatus(result.error ?? 'Login failed', COLORS.error);
    }
  }

  // ─── Register Screen ──────────────────────────────────────────────

  private showRegisterScreen(): void {
    this.clearUI();
    this.mode = 'register';

    const cardH = 530;
    this.drawCard(cardH, this.app.screen.height / 2 - cardH / 2 - 10);

    let y = 28;
    this.addCardTitle('Create Account', y);
    y += 36;
    this.addCardSubtitle('Join the mining adventure', y);
    y += 36;

    this.fields = [
      { name: 'firstName', value: '', label: 'First Name', placeholder: 'John' },
      { name: 'lastName', value: '', label: 'Last Name', placeholder: 'Doe' },
      { name: 'email', value: '', label: 'Email', placeholder: 'you@email.com' },
      { name: 'nickname', value: '', label: 'Game Nickname', placeholder: 'CoolMiner42' },
      { name: 'password', value: '', label: 'Password', isPassword: true, placeholder: 'Min. 4 characters' },
    ];
    this.activeFieldIndex = 0;

    y = this.createInputField('First Name', 'firstName', y, 'John');
    y = this.createInputField('Last Name', 'lastName', y, 'Doe');
    y = this.createInputField('Email', 'email', y, 'you@email.com');
    y = this.createInputField('Nickname', 'nickname', y, 'CoolMiner42');
    y = this.createInputField('Password', 'password', y, 'Min. 4 characters');
    y += 2;

    y = this.createPrimaryButton('Create Account', y, () => this.handleRegister());
    y += 2;
    this.createTextLink('Already have an account? Sign In', y, () => this.showLoginScreen());

    this.setupFormKeyHandler(() => this.handleRegister());
    this.updateFieldHighlights();
  }

  private async handleRegister(): Promise<void> {
    const firstName = this.fields.find(f => f.name === 'firstName')?.value ?? '';
    const lastName = this.fields.find(f => f.name === 'lastName')?.value ?? '';
    const email = this.fields.find(f => f.name === 'email')?.value ?? '';
    const nickname = this.fields.find(f => f.name === 'nickname')?.value ?? '';
    const password = this.fields.find(f => f.name === 'password')?.value ?? '';

    if (!firstName || !lastName || !email || !nickname || !password) {
      this.setStatus('Please fill in all fields', COLORS.error);
      return;
    }

    this.setStatus('Creating your account...', COLORS.warning);
    const result = await AuthClient.register({ email, password, firstName, lastName, nickname });

    if (result.success && result.token && result.nickname) {
      sessionManager.saveAuth(result.token, result.nickname);
      this.connection.send({ type: 'auth', token: result.token });
      this.setStatus(`Welcome, ${result.nickname}!`, COLORS.success);
      setTimeout(() => this.showMenu(), 600);
    } else {
      this.setStatus(result.error ?? 'Registration failed', COLORS.error);
    }
  }

  // ─── Forgot Password ─────────────────────────────────────────────

  private showForgotScreen(): void {
    this.clearUI();
    this.mode = 'forgot';

    const cardH = 300;
    this.drawCard(cardH, this.app.screen.height / 2 - cardH / 2);

    let y = 30;
    this.addCardTitle('Reset Password', y);
    y += 36;
    this.addCardSubtitle('We\'ll send you a reset link', y);
    y += 40;

    this.fields = [{ name: 'email', value: '', label: 'Email', placeholder: 'you@email.com' }];
    this.activeFieldIndex = 0;

    y = this.createInputField('Email', 'email', y, 'you@email.com');
    y += 4;
    y = this.createPrimaryButton('Send Reset Link', y, () => this.handleForgot());
    y += 4;
    this.createTextLink('Back to Sign In', y, () => this.showLoginScreen());

    this.setupFormKeyHandler(() => this.handleForgot());
    this.updateFieldHighlights();
  }

  private async handleForgot(): Promise<void> {
    const email = this.fields.find(f => f.name === 'email')?.value ?? '';
    if (!email) {
      this.setStatus('Please enter your email', COLORS.error);
      return;
    }

    this.setStatus('Sending...', COLORS.warning);
    await AuthClient.forgotPassword(email);
    this.setStatus('If the email exists, a reset link was sent.', COLORS.success);
  }

  // ─── Menu ─────────────────────────────────────────────────────────

  private showMenu(): void {
    this.clearUI();
    this.mode = 'menu';

    const cardH = 530;
    this.drawCard(cardH, this.app.screen.height / 2 - cardH / 2 - 10);

    const nickname = sessionManager.getNickname() ?? 'Miner';
    let y = 28;

    // Avatar circle with initial
    const avatar = new Graphics();
    avatar.circle(0, y + 28, 28);
    avatar.fill({ color: COLORS.accent });
    this.cardContainer.addChild(avatar);
    this.uiElements.push(avatar as unknown as Container);

    const initial = new Text({
      text: nickname.charAt(0).toUpperCase(),
      style: new TextStyle({
        fontFamily: "'Fredoka', 'SF Pro Display', -apple-system, sans-serif",
        fontSize: 26, fontWeight: '700', fill: '#1a1229',
      }),
    });
    initial.anchor.set(0.5, 0.5);
    initial.y = y + 28;
    this.cardContainer.addChild(initial);
    this.uiElements.push(initial as unknown as Container);

    y += 66;
    this.addCardTitle(nickname, y);
    y += 32;
    this.addCardSubtitle('Ready to mine', y);
    y += 36;

    y = this.addDivider(y);

    // Menu buttons
    const menuItems: [string, number, () => void][] = [
      ['Quick Play', 0x2d6a4f, () => {
        this.setStatus('Finding a game...', COLORS.warning);
        this.connection.send({ type: 'join_quick_play' });
      }],
      ['Create Match', 0x1d3557, () => {
        this.setStatus('Creating match...', COLORS.warning);
        this.connection.send({ type: 'create_match', matchName: `Match_${Date.now().toString(36).slice(-4).toUpperCase()}` });
      }],
      ['Browse Matches', 0x4a3060, () => {
        this.setStatus('Loading...', COLORS.warning);
        this.connection.send({ type: 'list_matches' });
      }],
      ['Join by Code', 0x3d3040, () => this.showJoinInput()],
      ['Play Solo', 0x2a2a3a, () => {
        this.setStatus('Starting solo...', COLORS.warning);
        this.connection.send({ type: 'play_solo' });
      }],
    ];

    for (const [label, color, action] of menuItems) {
      this.createSecondaryButton(label, y, INPUT_WIDTH, color, action);
      y += 54;
    }

    y += 8;
    y = this.addDivider(y);

    // Logout button — visible, not just a link
    this.createSecondaryButton('Sign Out', y, INPUT_WIDTH, 0x3a2020, () => {
      sessionManager.clearAuth();
      this.showLoginScreen();
    });
  }

  // ─── Join by Code ─────────────────────────────────────────────────

  private showJoinInput(): void {
    this.clearUI();
    this.removeKeyHandler();
    this.roomCodeInput = '';
    this.mode = 'joining';

    const cardH = 300;
    this.drawCard(cardH, this.app.screen.height / 2 - cardH / 2);

    let y = 30;
    this.addCardTitle('Join Match', y);
    y += 36;
    this.addCardSubtitle('Enter the match code', y);
    y += 44;

    // Code input display
    const codeContainer = new Container();
    codeContainer.y = y;
    const codeBg = new Graphics();
    codeBg.roundRect(-140, 0, 280, 52, RADIUS.input);
    codeBg.fill({ color: COLORS.inputBg });
    codeBg.roundRect(-140, 0, 280, 52, RADIUS.input);
    codeBg.stroke({ color: COLORS.inputBorderActive, width: 2 });
    codeContainer.addChild(codeBg);

    const codeDisplay = new Text({
      text: '_ _ _ _ _ _ _ _',
      style: new TextStyle({
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 22, fontWeight: '700', fill: '#f0a500', letterSpacing: 4,
      }),
    });
    codeDisplay.anchor.set(0.5, 0.5);
    codeDisplay.y = 26;
    codeContainer.addChild(codeDisplay);
    this.cardContainer.addChild(codeContainer);
    this.uiElements.push(codeContainer);
    y += 68;

    y = this.createPrimaryButton('Join', y, () => {
      if (this.roomCodeInput.length >= 4) {
        this.setStatus(`Joining ${this.roomCodeInput}...`, COLORS.warning);
        this.connection.send({ type: 'join_match', matchId: this.roomCodeInput });
      }
    });

    this.createTextLink('Back to Menu', y + 4, () => this.showMenu());

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.mode !== 'joining') return;
      if (e.key === 'Backspace') this.roomCodeInput = this.roomCodeInput.slice(0, -1);
      else if (e.key === 'Enter' && this.roomCodeInput.length >= 4) {
        this.setStatus(`Joining ${this.roomCodeInput}...`, COLORS.warning);
        this.connection.send({ type: 'join_match', matchId: this.roomCodeInput });
        return;
      } else if (/^[A-Za-z0-9]$/.test(e.key) && this.roomCodeInput.length < 8) {
        this.roomCodeInput += e.key.toUpperCase();
      }
      const padded = this.roomCodeInput.split('').concat(Array(8 - this.roomCodeInput.length).fill('_'));
      codeDisplay.text = padded.join(' ');
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  // ─── Match List ───────────────────────────────────────────────────

  private showMatchList(msg: MatchListMessage): void {
    this.clearUI();
    this.mode = 'match_list';

    const count = Math.min(msg.matches.length, 5);
    const cardH = count === 0 ? 220 : 160 + count * 56 + 60;
    this.drawCard(cardH, this.app.screen.height / 2 - cardH / 2);

    let y = 28;
    this.addCardTitle('Available Matches', y);
    y += 40;

    if (msg.matches.length === 0) {
      const emptyStyle = new TextStyle({
        fontFamily: "'Fredoka', 'SF Pro Display', -apple-system, sans-serif",
        fontSize: 15, fill: `#${COLORS.textMuted.toString(16).padStart(6, '0')}`,
      });
      const emptyText = new Text({ text: 'No matches available.\nCreate one!', style: emptyStyle });
      emptyText.anchor.set(0.5, 0);
      emptyText.y = y + 10;
      this.cardContainer.addChild(emptyText);
      this.uiElements.push(emptyText as unknown as Container);
      y += 70;
    } else {
      y = this.addDivider(y);
      for (const m of msg.matches.slice(0, 5)) {
        this.createSecondaryButton(
          `${m.matchName}  (${m.playerCount}/${m.maxPlayers})`,
          y, INPUT_WIDTH, 0x2d6a4f,
          () => {
            this.setStatus(`Joining ${m.matchName}...`, COLORS.warning);
            this.connection.send({ type: 'join_match', matchId: m.matchId });
          },
        );
        y += 54;
      }
    }

    this.createTextLink('Back to Menu', y + 8, () => this.showMenu());
  }

  // ─── Status Text ──────────────────────────────────────────────────

  private drawStatusText(): void {
    const style = new TextStyle({
      fontFamily: "'Fredoka', 'SF Pro Display', -apple-system, sans-serif",
      fontSize: 14,
      fontWeight: '600',
      fill: '#888888',
    });
    this.statusText = new Text({ text: '', style });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.x = this.app.screen.width / 2;
    this.statusText.y = this.app.screen.height - 40;
    this.container.addChild(this.statusText);
  }

  private setStatus(text: string, color: number | string = COLORS.textMuted): void {
    this.statusText.text = text;
    this.statusText.style.fill = typeof color === 'number'
      ? `#${color.toString(16).padStart(6, '0')}`
      : color;
  }

  // ─── Cleanup ──────────────────────────────────────────────────────

  private clearUI(): void {
    for (const el of this.uiElements) {
      this.cardContainer.removeChild(el);
      el.destroy({ children: true });
    }
    this.uiElements = [];
    this.inputDisplays.clear();
    this.fields = [];
    this.setStatus('');
  }

  private removeKeyHandler(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  update(_delta: number): void {}

  destroy(): void {
    this.removeKeyHandler();
    this.clearUI();
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
