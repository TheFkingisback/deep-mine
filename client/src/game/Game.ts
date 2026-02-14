import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { MiningScene } from './scenes/MiningScene';
import { SurfaceScene } from './scenes/SurfaceScene';
import { LobbyScene } from './scenes/LobbyScene';
import { PlayerState, EquipmentSlot } from '@shared/types';
import { createInventory } from '@shared/inventory';
import { Connection } from '../networking/Connection';
import { MessageHandler } from '../networking/MessageHandler';
import { SessionManager } from '../networking/SessionManager';
import type { MatchJoinedMessage } from '@shared/messages';
import { audioManager } from '../audio/AudioManager';
import { GameSaveManager } from './GameSaveManager';

export class Game {
  private app: Application;
  private currentScene: 'mining' | 'surface' | 'lobby';
  private miningScene: MiningScene | null = null;
  private surfaceScene: SurfaceScene | null = null;
  private lobbyScene: LobbyScene | null = null;
  private playerState!: PlayerState;
  private connection: Connection | null = null;
  private messageHandler: MessageHandler | null = null;

  // Match context
  private matchSeed = 0;
  private matchId = '';
  private playerDisplayName = '';

  // Navigation prevention
  private reloadBlockerHandler: ((e: KeyboardEvent) => void) | null = null;
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  // Auth
  private sessionManager = new SessionManager();

  // Auto-save
  private saveManager = new GameSaveManager();

  constructor(app: Application) {
    this.app = app;
    this.currentScene = 'lobby';
  }

  async init(): Promise<void> {
    console.log('🚀 Initializing Deep Mine...');

    // One-time migration: clear stale localStorage from pre-auth versions
    const migrationKey = 'deepmine_v2_migrated';
    if (!localStorage.getItem(migrationKey)) {
      localStorage.removeItem('deepmine_save');
      localStorage.removeItem('deep_mine_auth');
      localStorage.removeItem('deep_mine_session');
      localStorage.setItem(migrationKey, '1');
      console.log('🔄 Cleared stale localStorage data');
    }

    // Initialize audio system
    await audioManager.loadAll();

    // Check for saved game
    const savedGame = this.saveManager.load();
    if (savedGame) {
      console.log('💾 Restoring saved game...');
      await this.restoreFromSave(savedGame);
      this.setupNavigationPrevention();
      console.log('✅ Game restored from save');
      return;
    }

    // Connect to server (required for lobby)
    await this.connectToServer();

    if (this.connection && this.messageHandler) {
      // Start in lobby
      this.lobbyScene = new LobbyScene(this.app, this.connection, this.messageHandler);
      await this.lobbyScene.init();
      this.lobbyScene.setMatchFoundCallback((data) => this.onMatchFound(data));
    } else {
      // Offline fallback — go straight to mining with random seed
      this.startOfflineMining();
    }

    this.setupNavigationPrevention();
    console.log('✅ Deep Mine initialized');
  }

  private async connectToServer(): Promise<void> {
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const isDefaultPort = !window.location.port || window.location.port === '80' || window.location.port === '443';
      let wsUrl: string;
      if (isDefaultPort) {
        // Production — nginx proxies /ws to server
        wsUrl = `${wsProtocol}://${window.location.host}/ws`;
      } else {
        // Development — connect directly to server port
        const wsHost = import.meta.env.VITE_WS_HOST || window.location.hostname || 'localhost';
        wsUrl = `${wsProtocol}://${wsHost}:9001`;
      }
      this.connection = new Connection(wsUrl);
      await this.connection.connect();
      this.messageHandler = new MessageHandler(this.connection);
      console.log('🌐 Connected to server');

      // Send auth token if logged in
      const token = this.sessionManager.getToken();
      if (token) {
        this.connection.send({ type: 'auth', token });
        console.log('🔑 Sent auth token to server');
      }
      // Also send set_name as fallback (in case JWT validation fails)
      const nickname = this.sessionManager.getNickname();
      if (nickname) {
        this.connection.send({ type: 'set_name', name: nickname });
      }
    } catch {
      console.warn('⚠️ Could not connect to server — playing offline');
      this.connection = null;
      this.messageHandler = null;
    }
  }

  private collectSaveData() {
    return {
      playerState: structuredClone(this.playerState),
      matchSeed: this.matchSeed,
      matchId: this.matchId,
      currentScene: this.currentScene as 'mining' | 'surface',
      isOffline: this.connection === null,
    };
  }

  private async restoreFromSave(saved: import('./GameSaveManager').GameSaveData): Promise<void> {
    this.playerState = saved.playerState;
    this.matchSeed = saved.matchSeed;
    this.matchId = saved.matchId;
    this.playerDisplayName = this.sessionManager.getNickname() ?? '';

    if (!saved.isOffline) {
      await this.connectToServer();
    }

    if (saved.currentScene === 'mining') {
      this.currentScene = 'mining';
      this.miningScene = new MiningScene(
        this.app, this.playerState,
        this.connection ?? undefined, this.messageHandler ?? undefined,
        this.matchSeed, this.matchId, undefined, this.playerDisplayName,
      );
      await this.miningScene.init();
      this.miningScene.setSurfaceCallback(() => this.switchScene('surface'));
      this.miningScene.setGameOverCallback(() => this.handleGameOver());
      this.miningScene.setLogoutCallback(() => this.handleLogout());
    } else if (saved.currentScene === 'surface') {
      this.currentScene = 'surface';
      this.surfaceScene = new SurfaceScene(
        this.app, this.playerState,
        this.connection ?? undefined, this.messageHandler ?? undefined,
      );
      await this.surfaceScene.init();
      this.surfaceScene.setDescendToDepthCallback((depth) => {
        this.playerState.position.y = depth;
        this.switchScene('mining');
      });
      this.surfaceScene.setLogoutCallback(() => this.handleLogout());
      this.surfaceScene.setLeaveMatchCallback(() => this.handleLeaveMatch());
      this.surfaceScene.setSaveGameCallback(() => this.handleManualSave());
      this.surfaceScene.setIsOffline(this.connection === null);
    }

    this.saveManager.startAutoSave(() => this.collectSaveData());
  }

  private isInActiveGame(): boolean {
    return this.currentScene === 'mining' || this.currentScene === 'surface';
  }

  private handleLogout(): void {
    this.saveManager.stopAutoSave();
    this.saveManager.clear();
    this.sessionManager.clearAuth();
    this.switchScene('lobby');
  }

  private handleLeaveMatch(): void {
    this.saveManager.stopAutoSave();
    this.saveManager.clear();
    // Tell server we're leaving the match
    if (this.connection?.isConnected) {
      this.connection.send({ type: 'leave_match' });
    }
    this.switchScene('lobby');
  }

  private handleManualSave(): void {
    this.saveManager.save(this.collectSaveData());
  }

  private setupNavigationPrevention(): void {
    this.reloadBlockerHandler = (e: KeyboardEvent) => {
      if (!this.isInActiveGame()) return;
      if (e.key === 'F5') { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') { e.preventDefault(); return; }
    };
    window.addEventListener('keydown', this.reloadBlockerHandler);

    this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (!this.isInActiveGame()) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private async onMatchFound(data: MatchJoinedMessage): Promise<void> {
    console.log(`🎮 Match found: ${data.matchName} (${data.matchId}) seed=${data.seed} spawn=(${data.spawnX},${data.spawnY})`);

    // Destroy lobby
    if (this.lobbyScene) { this.lobbyScene.destroy(); this.lobbyScene = null; }

    this.matchSeed = data.seed;
    this.matchId = data.matchId;
    this.playerDisplayName = data.displayName ?? '';

    // Create player state from server data
    this.playerState = {
      id: data.playerId,
      position: { x: data.spawnX, y: data.spawnY },
      gold: 0,
      equipment: {
        [EquipmentSlot.SHOVEL]: 1,
        [EquipmentSlot.HELMET]: 1,
        [EquipmentSlot.VEST]: 1,
        [EquipmentSlot.TORCH]: 1,
        [EquipmentSlot.ROPE]: 1,
      },
      inventory: createInventory(8),
      maxInventorySlots: 8,
      inventoryUpgradeLevel: 0,
      maxDepthReached: 0,
      checkpoints: [],
      isStunned: false,
      stunEndTime: null,
      isOnSurface: false,
      lives: 2,
    };

    // Start mining scene with server seed and initial players
    this.currentScene = 'mining';
    this.miningScene = new MiningScene(
      this.app, this.playerState,
      this.connection ?? undefined, this.messageHandler ?? undefined,
      data.seed, data.matchId, data.players, this.playerDisplayName,
    );
    await this.miningScene.init();
    this.miningScene.setSurfaceCallback(() => this.switchScene('surface'));
    this.miningScene.setGameOverCallback(() => this.handleGameOver());
    this.miningScene.setLogoutCallback(() => this.handleLogout());
    this.saveManager.startAutoSave(() => this.collectSaveData());
  }

  private async startOfflineMining(): Promise<void> {
    this.matchSeed = Math.floor(Math.random() * 1000000);
    this.playerState = {
      id: 'player_1',
      position: { x: 1000, y: 1 },
      gold: 0,
      equipment: {
        [EquipmentSlot.SHOVEL]: 1,
        [EquipmentSlot.HELMET]: 1,
        [EquipmentSlot.VEST]: 1,
        [EquipmentSlot.TORCH]: 1,
        [EquipmentSlot.ROPE]: 1,
      },
      inventory: createInventory(8),
      maxInventorySlots: 8,
      inventoryUpgradeLevel: 0,
      maxDepthReached: 0,
      checkpoints: [],
      isStunned: false,
      stunEndTime: null,
      isOnSurface: false,
      lives: 2,
    };

    this.currentScene = 'mining';
    this.miningScene = new MiningScene(this.app, this.playerState);
    await this.miningScene.init();
    this.miningScene.setSurfaceCallback(() => this.switchScene('surface'));
    this.miningScene.setGameOverCallback(() => this.handleGameOver());
    this.miningScene.setLogoutCallback(() => this.handleLogout());
    this.saveManager.startAutoSave(() => this.collectSaveData());
  }

  async switchScene(scene: 'mining' | 'surface' | 'lobby'): Promise<void> {
    console.log(`🎬 Switching to scene: ${scene}`);

    // Auto-save before transition
    if (this.isInActiveGame()) {
      this.saveManager.save(this.collectSaveData());
    }

    // Clear save when returning to lobby
    if (scene === 'lobby') {
      this.saveManager.stopAutoSave();
      this.saveManager.clear();
    }

    // Destroy current scene
    if (this.currentScene === 'mining' && this.miningScene) {
      this.miningScene.destroy(); this.miningScene = null;
    } else if (this.currentScene === 'surface' && this.surfaceScene) {
      this.surfaceScene.destroy(); this.surfaceScene = null;
    } else if (this.currentScene === 'lobby' && this.lobbyScene) {
      this.lobbyScene.destroy(); this.lobbyScene = null;
    }

    this.currentScene = scene;

    if (scene === 'mining') {
      this.miningScene = new MiningScene(
        this.app, this.playerState,
        this.connection ?? undefined, this.messageHandler ?? undefined,
        this.matchSeed, this.matchId, undefined, this.playerDisplayName,
      );
      await this.miningScene.init();
      this.miningScene.setSurfaceCallback(() => this.switchScene('surface'));
      this.miningScene.setGameOverCallback(() => this.handleGameOver());
      this.miningScene.setLogoutCallback(() => this.handleLogout());
    } else if (scene === 'surface') {
      this.surfaceScene = new SurfaceScene(this.app, this.playerState, this.connection ?? undefined, this.messageHandler ?? undefined);
      await this.surfaceScene.init();
      this.surfaceScene.setDescendToDepthCallback((depth) => {
        this.playerState.position.y = depth;
        this.switchScene('mining');
      });
      this.surfaceScene.setLogoutCallback(() => this.handleLogout());
      this.surfaceScene.setLeaveMatchCallback(() => this.handleLeaveMatch());
      this.surfaceScene.setSaveGameCallback(() => this.handleManualSave());
      this.surfaceScene.setIsOffline(this.connection === null);
    } else if (scene === 'lobby') {
      // Reconnect if needed (e.g. after logout)
      if (!this.connection || !this.messageHandler) {
        await this.connectToServer();
      }
      if (this.connection && this.messageHandler) {
        this.lobbyScene = new LobbyScene(this.app, this.connection, this.messageHandler);
        await this.lobbyScene.init();
        this.lobbyScene.setMatchFoundCallback((data) => this.onMatchFound(data));
      } else {
        // Offline fallback — start mining directly
        this.startOfflineMining();
      }
    }

    console.log(`✅ Switched to ${scene} scene`);
  }

  update(delta: number): void {
    if (this.currentScene === 'mining' && this.miningScene) {
      this.miningScene.update(delta);
    } else if (this.currentScene === 'surface' && this.surfaceScene) {
      this.surfaceScene.update(delta);
    } else if (this.currentScene === 'lobby' && this.lobbyScene) {
      this.lobbyScene.update(delta);
    }
  }

  getCurrentScene(): 'mining' | 'surface' | 'lobby' {
    return this.currentScene;
  }

  private handleGameOver(): void {
    console.log('GAME OVER');
    this.saveManager.stopAutoSave();
    this.saveManager.clear();

    // Tell server we're leaving the match so we can rejoin later
    if (this.connection?.isConnected) {
      this.connection.send({ type: 'leave_match' });
    }

    // Show game over overlay
    const overlay = new Container();

    const bg = new Graphics();
    bg.rect(0, 0, this.app.screen.width, this.app.screen.height);
    bg.fill({ color: 0x000000, alpha: 0.8 });
    overlay.addChild(bg);

    const titleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif', fontSize: 56, fontWeight: 'bold', fill: '#FF2222',
      dropShadow: { color: '#000000', blur: 6, angle: Math.PI / 4, distance: 4 },
    });
    const title = new Text({ text: 'GAME OVER', style: titleStyle });
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = this.app.screen.height / 2 - 40;
    overlay.addChild(title);

    const subStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif', fontSize: 22, fill: '#CCCCCC',
    });
    const sub = new Text({ text: 'Returning to lobby...', style: subStyle });
    sub.anchor.set(0.5);
    sub.x = this.app.screen.width / 2;
    sub.y = this.app.screen.height / 2 + 30;
    overlay.addChild(sub);

    this.app.stage.addChild(overlay);

    // After 3 seconds, go back to lobby
    setTimeout(() => {
      this.app.stage.removeChild(overlay);
      overlay.destroy({ children: true });
      this.switchScene('lobby');
    }, 3000);
  }

}
