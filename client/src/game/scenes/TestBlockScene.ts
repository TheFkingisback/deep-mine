import { Application, Container, Text, TextStyle } from 'pixi.js';
import { BlockRenderer } from '../renderer/BlockRenderer';
import { Block, BlockType } from '@shared/types';

/**
 * Test scene for BlockRenderer verification.
 * Renders a 20x15 grid of blocks with various types and colors.
 */
export class TestBlockScene {
  private app: Application;
  private container: Container;
  private blockRenderer: BlockRenderer;
  private blocks: Block[][] = [];

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();
    this.app.stage.addChild(this.container);

    this.blockRenderer = new BlockRenderer(this.container);
  }

  /**
   * Initialize the test scene with sample blocks.
   */
  async init(): Promise<void> {
    console.log('🧪 Initializing BlockRenderer test scene...');

    // Create a 20x15 grid of test blocks
    const width = 20;
    const height = 15;

    for (let x = 0; x < width; x++) {
      this.blocks[x] = [];
      for (let y = 0; y < height; y++) {
        const depth = y * 50; // Vary depth to test different layers

        // Determine block type
        let blockType = BlockType.DIRT;
        if (depth < 50) blockType = BlockType.DIRT;
        else if (depth < 150) blockType = BlockType.CLAY_BLOCK;
        else if (depth < 300) blockType = BlockType.ROCK;
        else if (depth < 500) blockType = BlockType.DENSE_ROCK;
        else if (depth < 800) blockType = BlockType.OBSIDIAN;
        else if (depth < 1200) blockType = BlockType.COLD_MAGMA;
        else blockType = BlockType.VOID_STONE;

        // Add some TNT blocks randomly
        if (Math.random() < 0.05) {
          blockType = BlockType.TNT;
        }

        // Add some empty blocks
        if (Math.random() < 0.1) {
          blockType = BlockType.EMPTY;
        }

        this.blocks[x][y] = {
          type: blockType,
          hp: 100,
          maxHp: 100,
          x: x,
          y: depth / 50 // Convert depth back to grid position
        };
      }
    }

    // Render the blocks
    this.render();

    // Add info text
    this.addInfoText();

    console.log('✅ BlockRenderer test scene initialized');
    console.log(`📊 Active blocks: ${this.blockRenderer.getActiveBlockCount()}`);
    console.log(`🔄 Pool size: ${this.blockRenderer.getPoolSize()}`);
  }

  /**
   * Render the test blocks.
   */
  private render(): void {
    // Simulate player position at center
    const playerPos = {
      x: 10,
      y: 7
    };

    // Render with full visibility (large torch radius)
    const torchRadius = 20;

    this.blockRenderer.renderChunk(
      this.blocks,
      0,
      0,
      playerPos,
      torchRadius
    );

    // Center camera on player
    this.blockRenderer.setCamera(playerPos.x, playerPos.y);
  }

  /**
   * Add informational text to the scene.
   */
  private addInfoText(): void {
    const style = new TextStyle({
      fontFamily: 'Arial, monospace',
      fontSize: 14,
      fill: '#ffffff',
      stroke: { color: '#000000', width: 2 }
    });

    const text = new Text({
      text: 'BlockRenderer Test\n20x15 grid • Various layers • TNT blocks (red)\nOre sparkles visible on some blocks',
      style
    });

    text.x = 10;
    text.y = 10;

    this.app.stage.addChild(text);
  }

  /**
   * Update the scene (called every frame).
   */
  update(delta: number): void {
    // Could add animations here (e.g., pulsing TNT glow)
  }

  /**
   * Clean up the scene.
   */
  destroy(): void {
    this.blockRenderer.clear();
    this.app.stage.removeChild(this.container);
  }
}
