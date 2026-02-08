import { Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js';
import { DropItem, ItemType } from '@shared/types';
import { ITEMS } from '@shared/items';
import { BLOCK_SIZE } from '@shared/constants';

/**
 * Stores visual representation and animation state for a dropped item.
 */
interface DropVisual {
  /** Container holding all visual elements (glow + emoji) */
  sprite: Container;
  /** The drop data */
  dropItem: DropItem;
  /** Random phase offset for bobbing animation (0 to 2*PI) */
  bobOffset: number;
  /** Time accumulator for animations */
  time: number;
}

/**
 * ItemDropRenderer manages the visual rendering of dropped items in the world.
 * Items appear as floating emojis with rarity-based glows that bob gently.
 * When collected, they play a shrink animation before disappearing.
 */
export class ItemDropRenderer {
  private container: Container;
  private drops: Map<string, DropVisual> = new Map();
  private readonly bobSpeed = 0.003; // radians per ms

  // Rarity-based glow colors
  private readonly glowColors: Record<string, { color: number; alpha: number }> = {
    common: { color: 0xFFFFFF, alpha: 0.2 },
    uncommon: { color: 0x00FF00, alpha: 0.3 },
    rare: { color: 0x0088FF, alpha: 0.4 },
    epic: { color: 0x9900FF, alpha: 0.5 },
    legendary: { color: 0xFFD700, alpha: 0.6 }
  };

  constructor(stage: Container) {
    this.container = new Container();
    stage.addChild(this.container);
  }

  /**
   * Create visual for a dropped item at its world position.
   *
   * @param drop - The drop item to render
   */
  addDrop(drop: DropItem): void {
    // Get item definition
    const itemDef = ITEMS[drop.itemType];
    if (!itemDef) {
      console.warn(`Unknown item type: ${drop.itemType}`);
      return;
    }

    // Create container for this drop
    const dropContainer = new Container();

    // Create background glow based on rarity
    const glowConfig = this.glowColors[itemDef.rarity] || this.glowColors.common;
    const glow = new Graphics();
    glow.circle(0, 0, 10);
    glow.fill({ color: glowConfig.color, alpha: glowConfig.alpha });
    dropContainer.addChild(glow);

    // Create item icon (emoji)
    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 16,
      align: 'center'
    });
    const icon = new Text({ text: itemDef.emoji, style });
    icon.anchor.set(0.5);
    dropContainer.addChild(icon);

    // Position at block center (world coordinates)
    dropContainer.x = drop.position.x * BLOCK_SIZE + BLOCK_SIZE / 2;
    dropContainer.y = drop.position.y * BLOCK_SIZE + BLOCK_SIZE / 2;

    // Random bob offset so drops don't sync
    const bobOffset = Math.random() * Math.PI * 2;

    // Store in map
    this.drops.set(drop.id, {
      sprite: dropContainer,
      dropItem: drop,
      bobOffset,
      time: 0
    });

    this.container.addChild(dropContainer);

    console.log(`Added drop: ${itemDef.name} (${itemDef.emoji}) at (${drop.position.x}, ${drop.position.y})`);
  }

  /**
   * Remove a drop with collection animation.
   * Scales from 1.0 to 0.0 and moves up 20px over 200ms.
   *
   * @param dropId - The ID of the drop to remove
   */
  removeDrop(dropId: string): void {
    const visual = this.drops.get(dropId);
    if (!visual) {
      return;
    }

    // Play collection animation
    const startY = visual.sprite.y;
    const duration = 200; // ms
    let elapsed = 0;

    const animate = (ticker: Ticker) => {
      elapsed += ticker.deltaMS;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);

      // Scale down to 0
      visual.sprite.scale.set(1 - eased);

      // Move up 20px
      visual.sprite.y = startY - eased * 20;

      // When complete, clean up
      if (progress >= 1) {
        ticker.remove(animate);
        this.container.removeChild(visual.sprite);
        visual.sprite.destroy({ children: true });
        this.drops.delete(dropId);
      }
    };

    Ticker.shared.add(animate);
  }

  /**
   * Update all drops with bobbing animation and camera positioning.
   *
   * @param deltaMs - Time elapsed since last update in milliseconds
   * @param cameraOffset - Camera offset to apply { x, y }
   */
  update(deltaMs: number, cameraOffset: { x: number; y: number }): void {
    this.drops.forEach((visual, id) => {
      // Update time
      visual.time += deltaMs;

      // Bob Y position using sin wave
      const bobPhase = visual.time * this.bobSpeed + visual.bobOffset;
      const bobAmount = Math.sin(bobPhase) * 5; // ±5 pixels

      // Calculate world position
      const worldX = visual.dropItem.position.x * BLOCK_SIZE + BLOCK_SIZE / 2;
      const worldY = visual.dropItem.position.y * BLOCK_SIZE + BLOCK_SIZE / 2;

      // Apply camera offset and bobbing
      visual.sprite.x = worldX;
      visual.sprite.y = worldY + bobAmount;

      // Pulse glow for epic/legendary items
      const itemDef = ITEMS[visual.dropItem.itemType];
      if (itemDef.rarity === 'epic' || itemDef.rarity === 'legendary') {
        const glowGraphics = visual.sprite.children[0] as Graphics;
        if (glowGraphics) {
          // Pulse alpha between 0.4 and 0.8
          const pulsePhase = visual.time * 0.002; // Slower pulse
          const pulseAlpha = 0.6 + Math.sin(pulsePhase) * 0.2;
          glowGraphics.alpha = pulseAlpha;
        }
      }
    });
  }

  /**
   * Get the drop at a specific block position.
   *
   * @param blockX - Block X coordinate
   * @param blockY - Block Y coordinate
   * @returns The drop item at that position, or null if none exists
   */
  getDropAtPosition(blockX: number, blockY: number): DropItem | null {
    for (const visual of this.drops.values()) {
      if (visual.dropItem.position.x === blockX && visual.dropItem.position.y === blockY) {
        return visual.dropItem;
      }
    }
    return null;
  }

  /**
   * Clear all drops.
   */
  clear(): void {
    this.drops.forEach((visual) => {
      this.container.removeChild(visual.sprite);
      visual.sprite.destroy({ children: true });
    });
    this.drops.clear();
  }

  /**
   * Clean up the renderer.
   */
  destroy(): void {
    this.clear();
    this.container.destroy({ children: true });
  }
}
