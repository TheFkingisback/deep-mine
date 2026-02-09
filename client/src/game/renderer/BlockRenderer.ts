import { Container, Graphics } from 'pixi.js';
import { Block, BlockType, Position } from '@shared/types';
import { getLayerAtDepth } from '@shared/layers';

/**
 * BlockRenderer manages the rendering of blocks in the game world.
 * Uses object pooling for performance and handles visual effects like
 * torch lighting, 3D shading, block textures, and special block types.
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
   */
  renderChunk(
    blocks: Block[][],
    offsetX: number,
    offsetY: number,
    playerPos: Position,
    torchRadius: number
  ): void {
    const renderedKeys = new Set<string>();

    for (let x = 0; x < blocks.length; x++) {
      for (let y = 0; y < blocks[x].length; y++) {
        const block = blocks[x][y];
        if (block.type === BlockType.EMPTY) continue;

        const worldX = block.x;
        const worldY = block.y;
        const blockKey = `${worldX},${worldY}`;
        const screenX = worldX * this.blockSize;
        const screenY = worldY * this.blockSize;

        // Calculate distance from player for lighting
        const dx = worldX - playerPos.x;
        const dy = worldY - playerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Smooth lighting: 1.0 at center, fades to 0.0 at edge of torch radius
        const lightLevel = Math.max(0, 1.0 - (distance / torchRadius));

        let sprite = this.activeBlocks.get(blockKey);
        if (!sprite) {
          sprite = this.getBlockSprite();
          this.activeBlocks.set(blockKey, sprite);
          this.container.addChild(sprite);
        }

        sprite.clear();

        if (lightLevel > 0) {
          this.renderLitBlock(sprite, block, screenX, screenY, lightLevel);
        } else {
          this.renderDarkBlock(sprite, screenX, screenY);
        }

        renderedKeys.add(blockKey);
      }
    }

    // Remove blocks no longer in view
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
   * Renders a lit block with 3D shading, textures, and depth.
   */
  private renderLitBlock(sprite: Graphics, block: Block, screenX: number, screenY: number, lightLevel: number): void {
    sprite.x = screenX;
    sprite.y = screenY;

    // Handle special block types first
    if (block.type === BlockType.TNT) {
      this.renderTNTBlock(sprite, screenX, screenY, lightLevel);
      return;
    }
    if (block.type === BlockType.UNKNOWN) {
      this.renderUnknownBlock(sprite, screenX, screenY, lightLevel);
      return;
    }

    const layer = getLayerAtDepth(block.y);
    const baseColor = this.hexToNumber(layer.color);
    const variation = this.getBlockVariation(block.x, block.y);
    const color = this.varyBrightness(baseColor, variation);

    // Apply lighting: dim the color based on light level
    const litColor = this.applyLighting(color, lightLevel);
    const highlightColor = this.applyLighting(this.brighten(color, 0.35), lightLevel);
    const shadowColor = this.applyLighting(this.darken(color, 0.35), lightLevel);
    const midColor = this.applyLighting(this.darken(color, 0.15), lightLevel);

    const bs = this.blockSize;

    // Main block body
    sprite.roundRect(0, 0, bs, bs, 2);
    sprite.fill(litColor);

    // 3D top edge highlight (lighter strip at top)
    sprite.rect(1, 0, bs - 2, 4);
    sprite.fill({ color: highlightColor, alpha: 0.6 });

    // 3D left edge highlight (lighter strip on left)
    sprite.rect(0, 1, 3, bs - 2);
    sprite.fill({ color: highlightColor, alpha: 0.3 });

    // 3D bottom shadow (darker strip at bottom)
    sprite.rect(1, bs - 4, bs - 2, 4);
    sprite.fill({ color: shadowColor, alpha: 0.5 });

    // 3D right shadow (darker strip on right)
    sprite.rect(bs - 3, 1, 3, bs - 2);
    sprite.fill({ color: shadowColor, alpha: 0.3 });

    // Block type textures
    this.addBlockTexture(sprite, block, litColor, midColor, shadowColor, lightLevel);

    // Ore sparkle hints
    if (this.shouldShowOreHint(block)) {
      this.addOreSparkles(sprite, block, lightLevel);
    }

    // HP crack overlay (show cracks when block is damaged)
    if (block.hp < block.maxHp) {
      this.addCrackOverlay(sprite, block);
    }
  }

  /**
   * Add texture patterns based on block type.
   */
  private addBlockTexture(sprite: Graphics, block: Block, color: number, midColor: number, shadowColor: number, lightLevel: number): void {
    const bs = this.blockSize;
    const hash = this.hashBlock(block.x, block.y);
    const hash2 = this.hashBlock(block.x + 37, block.y + 53);
    const hash3 = this.hashBlock(block.x + 97, block.y + 17);

    switch (block.type) {
      case BlockType.DIRT: {
        // Dirt: small dots/pebbles scattered
        const dotColor = this.applyLighting(this.darken(color, 0.25), lightLevel);
        const count = 3 + Math.floor(hash * 3);
        for (let i = 0; i < count; i++) {
          const px = 4 + this.hashBlock(block.x + i * 31, block.y) * (bs - 8);
          const py = 4 + this.hashBlock(block.x, block.y + i * 47) * (bs - 8);
          const r = 1 + this.hashBlock(block.x + i, block.y + i) * 1.5;
          sprite.circle(px, py, r);
          sprite.fill({ color: dotColor, alpha: 0.5 });
        }
        // Horizontal grain lines
        if (hash > 0.4) {
          const ly = 8 + hash * 20;
          sprite.moveTo(3, ly);
          sprite.lineTo(bs - 3, ly + hash2 * 3 - 1.5);
          sprite.stroke({ width: 1, color: midColor, alpha: 0.3 });
        }
        break;
      }
      case BlockType.CLAY_BLOCK: {
        // Clay: horizontal layered lines
        const lineColor = this.applyLighting(this.darken(color, 0.2), lightLevel);
        for (let i = 0; i < 3; i++) {
          const ly = 8 + i * 12 + hash * 4;
          sprite.moveTo(2, ly);
          sprite.lineTo(bs - 2, ly + (hash2 - 0.5) * 2);
          sprite.stroke({ width: 1.5, color: lineColor, alpha: 0.4 });
        }
        break;
      }
      case BlockType.ROCK: {
        // Rock: angular crack lines
        const crackColor = this.applyLighting(this.darken(color, 0.3), lightLevel);
        // Primary diagonal crack
        const cx = 5 + hash * 15;
        const cy = 5 + hash2 * 10;
        sprite.moveTo(cx, cy);
        sprite.lineTo(cx + 10 + hash3 * 10, cy + 8 + hash * 10);
        sprite.lineTo(cx + 15 + hash2 * 8, cy + 15 + hash3 * 10);
        sprite.stroke({ width: 1, color: crackColor, alpha: 0.5 });
        // Secondary short crack
        if (hash > 0.5) {
          sprite.moveTo(bs - 8 - hash2 * 10, 4 + hash3 * 8);
          sprite.lineTo(bs - 4 - hash * 5, 12 + hash2 * 10);
          sprite.stroke({ width: 0.8, color: crackColor, alpha: 0.35 });
        }
        break;
      }
      case BlockType.DENSE_ROCK: {
        // Dense rock: hatched pattern with mineral flecks
        const hatchColor = this.applyLighting(this.darken(color, 0.2), lightLevel);
        // Cross-hatching
        for (let i = 0; i < 2; i++) {
          const sx = 5 + i * 18 + hash * 5;
          sprite.moveTo(sx, 3);
          sprite.lineTo(sx + 8, bs - 3);
          sprite.stroke({ width: 0.7, color: hatchColor, alpha: 0.3 });
        }
        // Mineral flecks
        const fleckColor = this.applyLighting(0x888899, lightLevel);
        for (let i = 0; i < 2; i++) {
          const fx = 6 + this.hashBlock(block.x + i * 71, block.y) * (bs - 12);
          const fy = 6 + this.hashBlock(block.x, block.y + i * 83) * (bs - 12);
          sprite.rect(fx, fy, 3, 2);
          sprite.fill({ color: fleckColor, alpha: 0.5 });
        }
        break;
      }
      case BlockType.OBSIDIAN: {
        // Obsidian: glass-like reflections
        const shineColor = this.applyLighting(0x6644AA, lightLevel);
        // Diagonal shine streak
        sprite.moveTo(5 + hash * 10, 3);
        sprite.lineTo(8 + hash * 10, 3);
        sprite.lineTo(bs - 5 + hash2 * 5, bs - 5);
        sprite.lineTo(bs - 8 + hash2 * 5, bs - 5);
        sprite.closePath();
        sprite.fill({ color: shineColor, alpha: 0.15 });
        // Small bright spot
        sprite.circle(10 + hash * 15, 8 + hash2 * 8, 2);
        sprite.fill({ color: 0xAA88DD, alpha: 0.3 * lightLevel });
        break;
      }
      case BlockType.COLD_MAGMA: {
        // Cold magma: glowing veins
        const veinColor = this.applyLighting(0xFF3300, lightLevel);
        const veinGlow = this.applyLighting(0xFF6600, lightLevel);
        // Winding vein
        sprite.moveTo(3 + hash * 8, 10 + hash2 * 10);
        sprite.quadraticCurveTo(bs / 2 + (hash3 - 0.5) * 10, bs / 2 + (hash - 0.5) * 8, bs - 3 - hash2 * 8, bs - 8 - hash3 * 10);
        sprite.stroke({ width: 2.5, color: veinGlow, alpha: 0.3 });
        sprite.moveTo(3 + hash * 8, 10 + hash2 * 10);
        sprite.quadraticCurveTo(bs / 2 + (hash3 - 0.5) * 10, bs / 2 + (hash - 0.5) * 8, bs - 3 - hash2 * 8, bs - 8 - hash3 * 10);
        sprite.stroke({ width: 1.2, color: veinColor, alpha: 0.5 });
        break;
      }
      case BlockType.VOID_STONE: {
        // Void stone: dark with purple energy sparks
        const sparkColor = this.applyLighting(0x8800FF, lightLevel);
        for (let i = 0; i < 3; i++) {
          const sx = 5 + this.hashBlock(block.x + i * 43, block.y) * (bs - 10);
          const sy = 5 + this.hashBlock(block.x, block.y + i * 67) * (bs - 10);
          sprite.circle(sx, sy, 1.5);
          sprite.fill({ color: sparkColor, alpha: 0.6 });
          // Mini glow around spark
          sprite.circle(sx, sy, 4);
          sprite.fill({ color: sparkColor, alpha: 0.1 });
        }
        break;
      }
    }
  }

  /**
   * Add crack overlay showing block damage progress.
   */
  private addCrackOverlay(sprite: Graphics, block: Block): void {
    const dmgRatio = 1 - (block.hp / block.maxHp);
    if (dmgRatio < 0.1) return;

    const bs = this.blockSize;
    const crackAlpha = dmgRatio * 0.6;
    const crackColor = 0x000000;

    // Draw crack lines based on damage level
    if (dmgRatio > 0.1) {
      sprite.moveTo(bs * 0.3, bs * 0.1);
      sprite.lineTo(bs * 0.5, bs * 0.4);
      sprite.lineTo(bs * 0.4, bs * 0.6);
      sprite.stroke({ width: 1.5, color: crackColor, alpha: crackAlpha });
    }
    if (dmgRatio > 0.4) {
      sprite.moveTo(bs * 0.6, bs * 0.2);
      sprite.lineTo(bs * 0.55, bs * 0.5);
      sprite.lineTo(bs * 0.7, bs * 0.8);
      sprite.stroke({ width: 1.5, color: crackColor, alpha: crackAlpha });
    }
    if (dmgRatio > 0.7) {
      sprite.moveTo(bs * 0.2, bs * 0.5);
      sprite.lineTo(bs * 0.5, bs * 0.55);
      sprite.lineTo(bs * 0.8, bs * 0.45);
      sprite.stroke({ width: 1, color: crackColor, alpha: crackAlpha * 0.7 });
    }
  }

  /**
   * Renders a dark block (outside torch radius) with subtle ambient glow.
   */
  private renderDarkBlock(sprite: Graphics, screenX: number, screenY: number): void {
    sprite.x = screenX;
    sprite.y = screenY;
    sprite.roundRect(0, 0, this.blockSize, this.blockSize, 2);
    sprite.fill(0x0A0A0F);
  }

  /**
   * Renders a TNT block with red color, glow, and fuse detail.
   */
  private renderTNTBlock(sprite: Graphics, screenX: number, screenY: number, lightLevel: number): void {
    sprite.x = screenX;
    sprite.y = screenY;

    const bs = this.blockSize;
    const tntColor = this.applyLighting(0xCC0000, lightLevel);
    const tntDark = this.applyLighting(0x990000, lightLevel);
    const glowColor = 0xFF4444;

    // Main block
    sprite.roundRect(0, 0, bs, bs, 2);
    sprite.fill(tntColor);

    // Top highlight
    sprite.rect(1, 0, bs - 2, 4);
    sprite.fill({ color: this.applyLighting(0xFF3333, lightLevel), alpha: 0.5 });

    // Bottom shadow
    sprite.rect(1, bs - 4, bs - 2, 4);
    sprite.fill({ color: tntDark, alpha: 0.5 });

    // Pulsing glow border
    const pulseAlpha = 0.3 + 0.15 * Math.sin(Date.now() / 300);
    sprite.roundRect(-1, -1, bs + 2, bs + 2, 3);
    sprite.stroke({ width: 2, color: glowColor, alpha: pulseAlpha });

    // TNT label bands
    sprite.rect(4, bs * 0.35, bs - 8, bs * 0.3);
    sprite.fill({ color: this.applyLighting(0xFFDD88, lightLevel), alpha: 0.8 });

    // "TNT" text approximation (three vertical marks)
    const markColor = this.applyLighting(0x880000, lightLevel);
    sprite.rect(10, bs * 0.38, 2, bs * 0.24);
    sprite.fill(markColor);
    sprite.rect(19, bs * 0.38, 2, bs * 0.24);
    sprite.fill(markColor);
    sprite.rect(28, bs * 0.38, 2, bs * 0.24);
    sprite.fill(markColor);

    // Fuse (top)
    sprite.moveTo(bs / 2, 0);
    sprite.lineTo(bs / 2 + 4, -3);
    sprite.stroke({ width: 2, color: this.applyLighting(0x8B5A2B, lightLevel) });
    // Fuse spark
    sprite.circle(bs / 2 + 4, -3, 2);
    sprite.fill({ color: 0xFFFF00, alpha: 0.5 + 0.3 * Math.sin(Date.now() / 150) });
  }

  /**
   * Renders an unknown block type.
   */
  private renderUnknownBlock(sprite: Graphics, screenX: number, screenY: number, lightLevel: number): void {
    sprite.x = screenX;
    sprite.y = screenY;

    const darkFill = this.applyLighting(0x0a0a0a, lightLevel * 0.3);
    sprite.roundRect(0, 0, this.blockSize, this.blockSize, 2);
    sprite.fill(darkFill);

    const qColor = this.applyLighting(0x444444, lightLevel);
    sprite.circle(this.blockSize / 2, this.blockSize / 2 - 5, 6);
    sprite.fill(qColor);
    sprite.rect(this.blockSize / 2 - 2, this.blockSize / 2 + 5, 4, 6);
    sprite.fill(qColor);
  }

  /**
   * Adds colored sparkle dots suggesting ore deposits.
   */
  private addOreSparkles(sprite: Graphics, block: Block, lightLevel: number): void {
    const sparkleCount = 2 + Math.floor(this.hashBlock(block.x, block.y) * 2);
    const layer = getLayerAtDepth(block.y);
    const sparkleColor = this.applyLighting(this.brighten(this.hexToNumber(layer.color), 0.6), lightLevel);

    for (let i = 0; i < sparkleCount; i++) {
      const hash = this.hashBlock(block.x, block.y + i * 100);
      const sx = 5 + hash * (this.blockSize - 10);
      const sy = 5 + this.hashBlock(block.x + i * 100, block.y) * (this.blockSize - 10);

      // Sparkle with glow
      sprite.circle(sx, sy, 2);
      sprite.fill({ color: sparkleColor, alpha: 0.9 });
      sprite.circle(sx, sy, 4);
      sprite.fill({ color: sparkleColor, alpha: 0.2 });
    }
  }

  updateBlock(x: number, y: number, block: Block | null): void {
    const blockKey = `${x},${y}`;
    const sprite = this.activeBlocks.get(blockKey);

    if (block === null) {
      if (sprite) {
        this.returnBlockSprite(sprite);
        this.activeBlocks.delete(blockKey);
      }
    } else {
      if (!sprite) {
        const newSprite = this.getBlockSprite();
        this.activeBlocks.set(blockKey, newSprite);
        this.container.addChild(newSprite);
      }
    }
  }

  setCamera(centerX: number, centerY: number): void {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    this.container.x = screenWidth / 2 - centerX * this.blockSize;
    this.container.y = screenHeight / 2 - centerY * this.blockSize;
  }

  clear(): void {
    this.activeBlocks.forEach(sprite => {
      this.returnBlockSprite(sprite);
    });
    this.activeBlocks.clear();
  }

  private getBlockSprite(): Graphics {
    if (this.blockPool.length > 0) {
      return this.blockPool.pop()!;
    }
    return new Graphics();
  }

  private returnBlockSprite(sprite: Graphics): void {
    sprite.clear();
    this.container.removeChild(sprite);
    if (this.blockPool.length < this.maxActiveBlocks) {
      this.blockPool.push(sprite);
    }
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  private getBlockVariation(x: number, y: number): number {
    const hash = this.hashBlock(x, y);
    return (hash - 0.5) * 0.2;
  }

  private hashBlock(x: number, y: number): number {
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    return (h % 1000) / 1000;
  }

  /**
   * Applies lighting level to a color. lightLevel 1.0 = full brightness, 0.0 = black.
   */
  private applyLighting(color: number, lightLevel: number): number {
    // Smooth cubic falloff for more dramatic lighting
    const intensity = lightLevel * lightLevel * (3 - 2 * lightLevel); // smoothstep
    const r = ((color >> 16) & 0xFF) * intensity;
    const g = ((color >> 8) & 0xFF) * intensity;
    const b = (color & 0xFF) * intensity;
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }

  private varyBrightness(color: number, percent: number): number {
    const r = (color >> 16) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = color & 0xFF;
    const factor = 1 + percent;
    return (Math.min(255, Math.max(0, Math.floor(r * factor))) << 16) |
           (Math.min(255, Math.max(0, Math.floor(g * factor))) << 8) |
           Math.min(255, Math.max(0, Math.floor(b * factor)));
  }

  private darken(color: number, percent: number): number {
    return this.varyBrightness(color, -percent);
  }

  private brighten(color: number, percent: number): number {
    return this.varyBrightness(color, percent);
  }

  private shouldShowOreHint(block: Block): boolean {
    if (block.y < 50) return false;
    return this.hashBlock(block.x, block.y) < 0.15;
  }

  getActiveBlockCount(): number {
    return this.activeBlocks.size;
  }

  getPoolSize(): number {
    return this.blockPool.length;
  }
}
