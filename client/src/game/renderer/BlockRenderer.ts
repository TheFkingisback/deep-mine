import { Container, Graphics } from 'pixi.js';
import { Block, BlockType, Position } from '@shared/types';
import { getLayerAtDepth } from '@shared/layers';

/**
 * BlockRenderer manages the rendering of blocks in the game world.
 * Uses object pooling for performance and handles visual effects like
 * torch lighting, block variation, and special block types (TNT, ore hints).
 */
export class BlockRenderer {
  private container: Container;
  private blockPool: Graphics[] = [];
  private activeBlocks: Map<string, Graphics> = new Map();
  private readonly blockSize = 40;
  private readonly maxActiveBlocks = 800;

  constructor(stage: Container) {
    this.container = new Container();
    stage.addChild(this.container);
  }

  /**
   * Renders a chunk of blocks with lighting and visual effects.
   * Only renders blocks within the torch radius as visible.
   *
   * @param blocks - 2D array of blocks to render
   * @param offsetX - World offset X coordinate
   * @param offsetY - World offset Y coordinate
   * @param playerPos - Player's current position
   * @param torchRadius - Radius of torch light in blocks
   */
  renderChunk(
    blocks: Block[][],
    offsetX: number,
    offsetY: number,
    playerPos: Position,
    torchRadius: number
  ): void {
    const renderedKeys = new Set<string>();

    // Iterate through all blocks in the chunk
    for (let x = 0; x < blocks.length; x++) {
      for (let y = 0; y < blocks[x].length; y++) {
        const block = blocks[x][y];

        // Skip empty blocks
        if (block.type === BlockType.EMPTY) {
          continue;
        }

        // Calculate world position
        const worldX = block.x;
        const worldY = block.y;
        const blockKey = `${worldX},${worldY}`;

        // Calculate screen position
        const screenX = worldX * this.blockSize;
        const screenY = worldY * this.blockSize;

        // Calculate distance from player for lighting
        const dx = worldX - playerPos.x;
        const dy = worldY - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isLit = distance <= torchRadius;

        // Get or create block sprite
        let sprite = this.activeBlocks.get(blockKey);
        if (!sprite) {
          sprite = this.getBlockSprite();
          this.activeBlocks.set(blockKey, sprite);
          this.container.addChild(sprite);
        }

        // Clear previous drawing
        sprite.clear();

        // Render based on lighting
        if (isLit) {
          this.renderLitBlock(sprite, block, screenX, screenY);
        } else {
          this.renderDarkBlock(sprite, screenX, screenY);
        }

        renderedKeys.add(blockKey);
      }
    }

    // Remove blocks that are no longer in view
    const toRemove: string[] = [];
    this.activeBlocks.forEach((sprite, key) => {
      if (!renderedKeys.has(key)) {
        toRemove.push(key);
      }
    });

    toRemove.forEach(key => {
      const sprite = this.activeBlocks.get(key);
      if (sprite) {
        this.returnBlockSprite(sprite);
        this.activeBlocks.delete(key);
      }
    });
  }

  /**
   * Renders a lit block with full visual details.
   */
  private renderLitBlock(sprite: Graphics, block: Block, screenX: number, screenY: number): void {
    sprite.x = screenX;
    sprite.y = screenY;

    // Get layer color
    const layer = getLayerAtDepth(block.y);
    const baseColor = this.hexToNumber(layer.color);

    // Add brightness variation based on block position hash
    const variation = this.getBlockVariation(block.x, block.y);
    const color = this.varyBrightness(baseColor, variation);

    // Handle special block types
    if (block.type === BlockType.TNT) {
      this.renderTNTBlock(sprite, screenX, screenY);
      return;
    }

    if (block.type === BlockType.UNKNOWN) {
      this.renderUnknownBlock(sprite, screenX, screenY);
      return;
    }

    // Draw main block shape with rounded corners
    sprite.roundRect(0, 0, this.blockSize, this.blockSize, 2);
    sprite.fill(color);

    // Add subtle inner shadow (darker border on bottom-right)
    const shadowColor = this.darken(color, 0.3);
    sprite.moveTo(this.blockSize, 2);
    sprite.lineTo(this.blockSize, this.blockSize);
    sprite.lineTo(2, this.blockSize);
    sprite.stroke({ width: 2, color: shadowColor, alpha: 0.5 });

    // Add ore sparkle hints (random chance based on depth)
    if (this.shouldShowOreHint(block)) {
      this.addOreSparkles(sprite, block);
    }
  }

  /**
   * Renders a dark block (outside torch radius).
   */
  private renderDarkBlock(sprite: Graphics, screenX: number, screenY: number): void {
    sprite.x = screenX;
    sprite.y = screenY;

    // Dark fill for unlit blocks
    sprite.roundRect(0, 0, this.blockSize, this.blockSize, 2);
    sprite.fill(0x111111);
  }

  /**
   * Renders a TNT block with red color and pulsing glow effect.
   */
  private renderTNTBlock(sprite: Graphics, screenX: number, screenY: number): void {
    sprite.x = screenX;
    sprite.y = screenY;

    const tntColor = 0xCC0000; // Red
    const glowColor = 0xFF4444; // Lighter red for glow

    // Draw main TNT block
    sprite.roundRect(0, 0, this.blockSize, this.blockSize, 2);
    sprite.fill(tntColor);

    // Add subtle glow effect (pulsing would be animated in update loop)
    sprite.roundRect(-1, -1, this.blockSize + 2, this.blockSize + 2, 3);
    sprite.stroke({ width: 3, color: glowColor, alpha: 0.4 });

    // Add TNT text/symbol
    sprite.circle(this.blockSize / 2, this.blockSize / 2, 8);
    sprite.fill(0xFFFFFF);
  }

  /**
   * Renders an unknown block type.
   */
  private renderUnknownBlock(sprite: Graphics, screenX: number, screenY: number): void {
    sprite.x = screenX;
    sprite.y = screenY;

    // Very dark fill
    sprite.roundRect(0, 0, this.blockSize, this.blockSize, 2);
    sprite.fill(0x0a0a0a);

    // Draw "?" symbol in dim gray
    // (In a real implementation, you'd use a Text object, but for simplicity we'll use shapes)
    sprite.circle(this.blockSize / 2, this.blockSize / 2 - 5, 6);
    sprite.fill(0x444444);
    sprite.rect(this.blockSize / 2 - 2, this.blockSize / 2 + 5, 4, 6);
    sprite.fill(0x444444);
  }

  /**
   * Adds small colored dots to suggest ore deposits.
   */
  private addOreSparkles(sprite: Graphics, block: Block): void {
    const sparkleCount = 2 + Math.floor(this.hashBlock(block.x, block.y) * 2); // 2-3 sparkles
    const layer = getLayerAtDepth(block.y);

    // Use a brighter version of layer color for sparkles
    const sparkleColor = this.brighten(this.hexToNumber(layer.color), 0.5);

    for (let i = 0; i < sparkleCount; i++) {
      const hash = this.hashBlock(block.x, block.y + i * 100);
      const sx = 5 + hash * (this.blockSize - 10);
      const sy = 5 + this.hashBlock(block.x + i * 100, block.y) * (this.blockSize - 10);

      sprite.circle(sx, sy, 1.5);
      sprite.fill({ color: sparkleColor, alpha: 0.8 });
    }
  }

  /**
   * Updates or removes a single block.
   *
   * @param x - World X coordinate
   * @param y - World Y coordinate
   * @param block - Block to render, or null to remove
   */
  updateBlock(x: number, y: number, block: Block | null): void {
    const blockKey = `${x},${y}`;
    const sprite = this.activeBlocks.get(blockKey);

    if (block === null) {
      // Remove block
      if (sprite) {
        this.returnBlockSprite(sprite);
        this.activeBlocks.delete(blockKey);
      }
    } else {
      // Update block
      if (!sprite) {
        const newSprite = this.getBlockSprite();
        this.activeBlocks.set(blockKey, newSprite);
        this.container.addChild(newSprite);
      }
      // Block will be updated in next renderChunk call
    }
  }

  /**
   * Sets the camera position by offsetting the container.
   *
   * @param centerX - Camera center X in world coordinates
   * @param centerY - Camera center Y in world coordinates
   */
  setCamera(centerX: number, centerY: number): void {
    // Convert world coordinates to screen position
    // Center the camera on the player
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    this.container.x = screenWidth / 2 - centerX * this.blockSize;
    this.container.y = screenHeight / 2 - centerY * this.blockSize;
  }

  /**
   * Clears all active blocks and returns them to the pool.
   */
  clear(): void {
    this.activeBlocks.forEach(sprite => {
      this.returnBlockSprite(sprite);
    });
    this.activeBlocks.clear();
  }

  /**
   * Gets a block sprite from the pool or creates a new one.
   */
  private getBlockSprite(): Graphics {
    if (this.blockPool.length > 0) {
      return this.blockPool.pop()!;
    }
    return new Graphics();
  }

  /**
   * Returns a block sprite to the pool.
   */
  private returnBlockSprite(sprite: Graphics): void {
    sprite.clear();
    this.container.removeChild(sprite);

    // Limit pool size to prevent memory issues
    if (this.blockPool.length < this.maxActiveBlocks) {
      this.blockPool.push(sprite);
    }
  }

  /**
   * Converts hex string to number.
   */
  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  /**
   * Gets brightness variation for a block (-0.1 to +0.1).
   */
  private getBlockVariation(x: number, y: number): number {
    const hash = this.hashBlock(x, y);
    return (hash - 0.5) * 0.2; // -0.1 to +0.1
  }

  /**
   * Simple hash function for block coordinates (returns 0-1).
   */
  private hashBlock(x: number, y: number): number {
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    return (h % 1000) / 1000;
  }

  /**
   * Varies brightness of a color by a percentage.
   */
  private varyBrightness(color: number, percent: number): number {
    const r = (color >> 16) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = color & 0xFF;

    const factor = 1 + percent;
    const newR = Math.min(255, Math.max(0, Math.floor(r * factor)));
    const newG = Math.min(255, Math.max(0, Math.floor(g * factor)));
    const newB = Math.min(255, Math.max(0, Math.floor(b * factor)));

    return (newR << 16) | (newG << 8) | newB;
  }

  /**
   * Darkens a color by a percentage.
   */
  private darken(color: number, percent: number): number {
    return this.varyBrightness(color, -percent);
  }

  /**
   * Brightens a color by a percentage.
   */
  private brighten(color: number, percent: number): number {
    return this.varyBrightness(color, percent);
  }

  /**
   * Determines if a block should show ore sparkle hints.
   */
  private shouldShowOreHint(block: Block): boolean {
    // Show hints for blocks deeper than 50 with 15% chance
    if (block.y < 50) return false;
    return this.hashBlock(block.x, block.y) < 0.15;
  }

  /**
   * Gets the number of active blocks being rendered.
   */
  getActiveBlockCount(): number {
    return this.activeBlocks.size;
  }

  /**
   * Gets the number of blocks in the pool.
   */
  getPoolSize(): number {
    return this.blockPool.length;
  }
}
