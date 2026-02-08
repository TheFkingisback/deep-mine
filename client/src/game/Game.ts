import { Application } from 'pixi.js';
import { MiningScene } from './scenes/MiningScene';
import { SurfaceScene } from './scenes/SurfaceScene';
import { PlayerState, EquipmentSlot } from '@shared/types';
import { createInventory } from '@shared/inventory';

/**
 * Main Game class that manages the entire game state and scenes.
 * Handles scene switching and the main game loop.
 */
export class Game {
  private app: Application;
  private currentScene: 'mining' | 'surface' | 'lobby';
  private miningScene: MiningScene | null = null;
  private surfaceScene: SurfaceScene | null = null;
  private playerState: PlayerState;

  constructor(app: Application) {
    this.app = app;
    this.currentScene = 'mining'; // Start directly in mining
  }

  /**
   * Initialize the game.
   * Sets up initial state and displays the mining scene.
   */
  async init(): Promise<void> {
    console.log('🚀 Initializing Deep Mine...');

    // Create initial player state for testing
    this.playerState = {
      id: 'player_1',
      position: { x: 1000, y: 1 }, // Center of 2000-block wide map, surface level
      gold: 0,
      equipment: {
        [EquipmentSlot.SHOVEL]: 1,
        [EquipmentSlot.HELMET]: 1,
        [EquipmentSlot.VEST]: 1,
        [EquipmentSlot.TORCH]: 1,
        [EquipmentSlot.ROPE]: 1
      },
      inventory: createInventory(8),
      maxInventorySlots: 8,
      inventoryUpgradeLevel: 0,
      maxDepthReached: 0,
      checkpoints: [],
      isStunned: false,
      stunEndTime: null,
      isOnSurface: false // Start mining directly
    };

    // Create and initialize mining scene directly
    this.miningScene = new MiningScene(this.app, this.playerState);
    await this.miningScene.init();

    // Set up surface area callback
    this.miningScene.setSurfaceCallback(() => {
      this.switchScene('surface');
    });

    console.log('✅ Deep Mine initialized');
  }

  /**
   * Switch to a different scene.
   * Destroys the current scene and creates/initializes the new one.
   *
   * @param scene - The scene to switch to
   */
  async switchScene(scene: 'mining' | 'surface' | 'lobby'): Promise<void> {
    console.log(`🎬 Switching to scene: ${scene}`);

    // Destroy current scene
    if (this.currentScene === 'mining' && this.miningScene) {
      this.miningScene.destroy();
      this.miningScene = null;
    } else if (this.currentScene === 'surface' && this.surfaceScene) {
      this.surfaceScene.destroy();
      this.surfaceScene = null;
    }

    // Update current scene
    this.currentScene = scene;

    // Create and initialize new scene
    if (scene === 'mining') {
      this.miningScene = new MiningScene(this.app, this.playerState);
      await this.miningScene.init();
      this.miningScene.setSurfaceCallback(() => {
        this.switchScene('surface');
      });
    } else if (scene === 'surface') {
      this.surfaceScene = new SurfaceScene(this.app, this.playerState);
      await this.surfaceScene.init();
      // When descending from surface, go back to last depth reached
      this.surfaceScene.setDescendToDepthCallback((depth) => {
        this.playerState.position.y = depth;
        this.switchScene('mining');
      });
    }

    console.log(`✅ Switched to ${scene} scene`);
  }

  /**
   * Main game update loop.
   * Called every frame by PixiJS ticker.
   *
   * @param delta - Time elapsed since last frame (in frames at 60fps)
   */
  update(delta: number): void {
    // Update current scene
    if (this.currentScene === 'mining' && this.miningScene) {
      this.miningScene.update(delta);
    } else if (this.currentScene === 'surface' && this.surfaceScene) {
      this.surfaceScene.update(delta);
    }
  }

  /**
   * Get the current scene name.
   */
  getCurrentScene(): 'mining' | 'surface' | 'lobby' {
    return this.currentScene;
  }
}
