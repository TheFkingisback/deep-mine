import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { MiningScene } from './scenes/MiningScene';
import { SurfaceScene } from './scenes/SurfaceScene';
import { LobbyScene } from './scenes/LobbyScene';
import { PlayerState, EquipmentSlot } from '@shared/types';
import { createInventory } from '@shared/inventory';
import { Connection } from '../networking/Connection';
import { MessageHandler } from '../networking/MessageHandler';
import type { MatchJoinedMessage } from '@shared/messages';
import { audioManager } from '../audio/AudioManager';

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

  constructor(app: Application) {
    this.app = app;
    this.currentScene = 'lobby';
  }

  async init(): Promise<void> {
    console.log('🚀 Initializing Deep Mine...');

    // Initialize audio system
    await audioManager.loadAll();

    // Connect to server (required for lobby)
    try {
      const wsHost = window.location.hostname || 'localhost';
      this.connection = new Connection(`ws://${wsHost}:9001`);
      await this.connection.connect();
      this.messageHandler = new MessageHandler(this.connection);
      console.log('🌐 Connected to server');
    } catch {
      console.warn('⚠️ Could not connect to server — playing offline');
      this.connection = null;
      this.messageHandler = null;
    }

    if (this.connection && this.messageHandler) {
      // Start in lobby
      this.lobbyScene = new LobbyScene(this.app, this.connection, this.messageHandler);
      await this.lobbyScene.init();
      this.lobbyScene.setMatchFoundCallback((data) => this.onMatchFound(data));
    } else {
      // Offline fallback — go straight to mining with random seed
      this.startOfflineMining();
    }

    console.log('✅ Deep Mine initialized');
  }

  private async onMatchFound(data: MatchJoinedMessage): Promise<void> {
    console.log(`🎮 Match found: ${data.matchName} (${data.matchId}) seed=${data.seed} spawn=(${data.spawnX},${data.spawnY})`);

    // Destroy lobby
    if (this.lobbyScene) { this.lobbyScene.destroy(); this.lobbyScene = null; }

    this.matchSeed = data.seed;
    this.matchId = data.matchId;

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
      data.seed, data.matchId, data.players,
    );
    await this.miningScene.init();
    this.miningScene.setSurfaceCallback(() => this.switchScene('surface'));
    this.miningScene.setGameOverCallback(() => this.handleGameOver());
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
  }

  async switchScene(scene: 'mining' | 'surface' | 'lobby'): Promise<void> {
    console.log(`🎬 Switching to scene: ${scene}`);

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
        this.matchSeed, this.matchId,
      );
      await this.miningScene.init();
      this.miningScene.setSurfaceCallback(() => this.switchScene('surface'));
      this.miningScene.setGameOverCallback(() => this.handleGameOver());
    } else if (scene === 'surface') {
      this.surfaceScene = new SurfaceScene(this.app, this.playerState, this.connection ?? undefined, this.messageHandler ?? undefined);
      await this.surfaceScene.init();
      this.surfaceScene.setDescendToDepthCallback((depth) => {
        this.playerState.position.y = depth;
        this.switchScene('mining');
      });
    } else if (scene === 'lobby') {
      if (this.connection && this.messageHandler) {
        this.lobbyScene = new LobbyScene(this.app, this.connection, this.messageHandler);
        await this.lobbyScene.init();
        this.lobbyScene.setMatchFoundCallback((data) => this.onMatchFound(data));
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
