import { Application, Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { InventorySlot } from '@shared/types';
import { ITEMS } from '@shared/items';

/**
 * InventoryPanel displays the player's inventory in a slide-in panel from the right.
 * Shows items in a grid with rarity-based borders and tooltips on hover.
 */
export class InventoryPanel {
  private app: Application;
  private container: Container;
  private background: Graphics;
  private panel: Container;
  private slotContainers: Container[] = [];

  private isOpen = false;
  private slideProgress = 0; // 0=closed, 1=open
  private slideDirection: 1 | -1 | 0 = 1;
  private readonly slideSpeed = 1 / 300; // 300ms animation

  // Tooltip
  private tooltipContainer: Container;
  private tooltipText: Text;
  private tooltipBg: Graphics;
  private tooltipVisible = false;

  // Panel dimensions
  private readonly panelWidth = 300;
  private readonly slotSize = 60;
  private readonly columns = 4;
  private readonly padding = 12;

  // Rarity colors
  private readonly rarityColors: Record<string, number> = {
    common: 0xAAAAAA,
    uncommon: 0x00CC00,
    rare: 0x4488FF,
    epic: 0xAA44FF,
    legendary: 0xFFD700
  };

  constructor(app: Application) {
    this.app = app;

    // Create main container (hidden initially)
    this.container = new Container();
    this.container.visible = false;

    // Create background overlay
    this.background = new Graphics();
    this.background.eventMode = 'static';
    this.background.on('pointerdown', () => this.close());
    this.container.addChild(this.background);

    // Create panel
    this.panel = new Container();
    this.container.addChild(this.panel);

    // Create tooltip
    this.tooltipContainer = new Container();
    this.tooltipContainer.visible = false;

    this.tooltipBg = new Graphics();
    this.tooltipContainer.addChild(this.tooltipBg);

    const tooltipStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 10,
      fill: '#FFFFFF',
      wordWrap: true,
      wordWrapWidth: 160
    });
    this.tooltipText = new Text({ text: '', style: tooltipStyle });
    this.tooltipText.x = 8;
    this.tooltipText.y = 8;
    this.tooltipContainer.addChild(this.tooltipText);

    this.container.addChild(this.tooltipContainer);

    // Add to stage
    this.app.stage.addChild(this.container);

    // Initial render
    this.renderBackground();
    this.renderPanel();
  }

  /**
   * Render the dark background overlay.
   */
  private renderBackground(): void {
    this.background.clear();
    this.background.rect(0, 0, this.app.screen.width, this.app.screen.height);
    this.background.fill({ color: 0x000000, alpha: 0.5 });
  }

  /**
   * Render the inventory panel structure.
   */
  private renderPanel(): void {
    this.panel.removeChildren();

    // Panel background
    const bg = new Graphics();
    bg.roundRect(0, 0, this.panelWidth, this.app.screen.height, 12);
    bg.fill(0x1E1E2E);
    this.panel.addChild(bg);

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const title = new Text({ text: 'INVENTORY', style: titleStyle });
    title.anchor.set(0.5, 0);
    title.x = this.panelWidth / 2;
    title.y = 15;
    this.panel.addChild(title);

    // Position panel off-screen to the right
    this.panel.x = this.app.screen.width;
  }

  /**
   * Populate inventory slots and render grid.
   */
  private populateSlots(inventory: (InventorySlot | null)[], maxSlots: number): void {
    // Clear existing slots
    this.slotContainers.forEach(slot => this.panel.removeChild(slot));
    this.slotContainers = [];

    // Create subtitle showing slot usage
    const usedSlots = inventory.filter(slot => slot !== null).length;
    const subtitleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fill: '#888888'
    });
    const subtitle = new Text({ text: `${usedSlots} / ${maxSlots} slots`, style: subtitleStyle });
    subtitle.anchor.set(0.5, 0);
    subtitle.x = this.panelWidth / 2;
    subtitle.y = 45;
    this.panel.addChild(subtitle);

    // Divider line
    const divider = new Graphics();
    divider.rect(this.padding, 70, this.panelWidth - this.padding * 2, 1);
    divider.fill(0x333333);
    this.panel.addChild(divider);

    // Grid area starts at Y=85
    const gridStartY = 85;

    // Create slots
    for (let i = 0; i < maxSlots; i++) {
      const slot = inventory[i];
      const col = i % this.columns;
      const row = Math.floor(i / this.columns);

      const slotContainer = this.createSlot(slot, col, row, gridStartY);
      this.slotContainers.push(slotContainer);
      this.panel.addChild(slotContainer);
    }
  }

  /**
   * Create a single inventory slot.
   */
  private createSlot(slot: InventorySlot | null, col: number, row: number, gridStartY: number): Container {
    const container = new Container();

    // Calculate position
    const x = this.padding + col * (this.slotSize + 8);
    const y = gridStartY + row * (this.slotSize + 8);

    container.x = x;
    container.y = y;

    // Slot background
    const bg = new Graphics();

    if (slot === null) {
      // Empty slot - dim border
      bg.roundRect(0, 0, this.slotSize, this.slotSize, 6);
      bg.stroke({ color: 0x333333, width: 2 });
    } else {
      // Filled slot - rarity-based border and background
      const itemDef = ITEMS[slot.itemType];
      const rarityColor = this.rarityColors[itemDef.rarity] || 0xAAAAAA;

      // Tinted background
      bg.roundRect(0, 0, this.slotSize, this.slotSize, 6);
      bg.fill({ color: rarityColor, alpha: 0.1 });
      bg.stroke({ color: rarityColor, width: 2 });

      // Item emoji
      const emojiStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 24
      });
      const emoji = new Text({ text: itemDef.emoji, style: emojiStyle });
      emoji.anchor.set(0.5);
      emoji.x = this.slotSize / 2;
      emoji.y = this.slotSize / 2;
      container.addChild(emoji);

      // Quantity indicator
      if (slot.quantity > 1) {
        // Dark background for quantity
        const qtyBg = new Graphics();
        qtyBg.roundRect(this.slotSize - 30, this.slotSize - 18, 26, 14, 3);
        qtyBg.fill({ color: 0x000000, alpha: 0.7 });
        container.addChild(qtyBg);

        // Quantity text
        const qtyStyle = new TextStyle({
          fontFamily: 'Arial, sans-serif',
          fontSize: 11,
          fontWeight: 'bold',
          fill: '#FFFFFF'
        });
        const qtyText = new Text({ text: `x${slot.quantity}`, style: qtyStyle });
        qtyText.anchor.set(0.5);
        qtyText.x = this.slotSize - 17;
        qtyText.y = this.slotSize - 11;
        container.addChild(qtyText);
      }

      // Tooltip on hover
      container.eventMode = 'static';
      container.cursor = 'pointer';

      container.on('pointerover', (event: FederatedPointerEvent) => {
        this.showTooltip(slot.itemType, event.global.x, event.global.y);
      });

      container.on('pointermove', (event: FederatedPointerEvent) => {
        this.updateTooltipPosition(event.global.x, event.global.y);
      });

      container.on('pointerout', () => {
        this.hideTooltip();
      });
    }

    container.addChild(bg);

    return container;
  }

  /**
   * Show tooltip for an item.
   */
  private showTooltip(itemType: string, x: number, y: number): void {
    const itemDef = ITEMS[itemType as keyof typeof ITEMS];

    // Build tooltip text
    const lines = [
      `§${itemDef.name}§`,
      itemDef.description,
      `§Sell value: ${itemDef.value}G each§`
    ];

    // Create formatted text with bold sections
    const formattedText = lines.map(line => {
      if (line.startsWith('§') && line.endsWith('§')) {
        return line.slice(1, -1); // Bold sections
      }
      return line;
    }).join('\n');

    this.tooltipText.text = formattedText;

    // Style bold sections
    const nameStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: '#FFFFFF',
      wordWrap: true,
      wordWrapWidth: 160
    });

    const descStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 10,
      fill: '#AAAAAA',
      wordWrap: true,
      wordWrapWidth: 160
    });

    const valueStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 10,
      fontWeight: 'bold',
      fill: '#FFD700',
      wordWrap: true,
      wordWrapWidth: 160
    });

    // Create multi-styled text
    const name = new Text({ text: itemDef.name, style: nameStyle });
    name.x = 8;
    name.y = 8;

    const desc = new Text({ text: itemDef.description, style: descStyle });
    desc.x = 8;
    desc.y = 28;

    const value = new Text({ text: `Sell value: ${itemDef.value}G each`, style: valueStyle });
    value.x = 8;
    value.y = 28 + desc.height + 4;

    // Clear and rebuild tooltip
    this.tooltipContainer.removeChildren();
    this.tooltipBg = new Graphics();
    this.tooltipContainer.addChild(this.tooltipBg);

    // Calculate tooltip size
    const tooltipWidth = 180;
    const tooltipHeight = name.height + desc.height + value.height + 24;

    // Draw background
    this.tooltipBg.roundRect(0, 0, tooltipWidth, tooltipHeight, 6);
    this.tooltipBg.fill({ color: 0x111111, alpha: 0.9 });

    this.tooltipContainer.addChild(name);
    this.tooltipContainer.addChild(desc);
    this.tooltipContainer.addChild(value);

    this.updateTooltipPosition(x, y);
    this.tooltipContainer.visible = true;
    this.tooltipVisible = true;
  }

  /**
   * Update tooltip position to follow pointer.
   */
  private updateTooltipPosition(x: number, y: number): void {
    if (!this.tooltipVisible) return;

    // Offset from cursor
    let tooltipX = x + 15;
    let tooltipY = y + 15;

    // Keep within screen bounds
    if (tooltipX + 180 > this.app.screen.width) {
      tooltipX = x - 180 - 15;
    }
    if (tooltipY + this.tooltipContainer.height > this.app.screen.height) {
      tooltipY = this.app.screen.height - this.tooltipContainer.height - 10;
    }

    this.tooltipContainer.x = tooltipX;
    this.tooltipContainer.y = tooltipY;
  }

  /**
   * Hide tooltip.
   */
  private hideTooltip(): void {
    this.tooltipContainer.visible = false;
    this.tooltipVisible = false;
  }

  /**
   * Open the inventory panel.
   */
  open(inventory: (InventorySlot | null)[], maxSlots: number): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.container.visible = true;
    this.slideDirection = 1;
    this.slideProgress = 0;

    // Populate slots
    this.populateSlots(inventory, maxSlots);

    // Fade in background
    this.background.alpha = 0;
  }

  /**
   * Close the inventory panel.
   */
  close(): void {
    if (!this.isOpen) return;

    this.slideDirection = -1;
    this.hideTooltip();
  }

  /**
   * Toggle the inventory panel.
   */
  toggle(inventory: (InventorySlot | null)[], maxSlots: number): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(inventory, maxSlots);
    }
  }

  /**
   * Update panel animation.
   */
  update(deltaMs: number): void {
    if (!this.container.visible && this.slideProgress === 0) {
      return;
    }

    // Animate slide
    if (this.slideDirection !== 0) {
      this.slideProgress += this.slideDirection * deltaMs * this.slideSpeed;
      this.slideProgress = Math.max(0, Math.min(1, this.slideProgress));

      // Update panel position
      const targetX = this.app.screen.width - this.panelWidth * this.slideProgress;
      this.panel.x = targetX;

      // Update background alpha
      this.background.alpha = 0.5 * this.slideProgress;

      // Check if animation complete
      if (this.slideProgress === 0) {
        this.container.visible = false;
        this.isOpen = false;
        this.slideDirection = 0;
      } else if (this.slideProgress === 1) {
        this.slideDirection = 0;
      }
    }
  }

  /**
   * Resize handler.
   */
  resize(width: number, height: number): void {
    this.renderBackground();
    this.renderPanel();

    // Update panel position based on current progress
    const targetX = width - this.panelWidth * this.slideProgress;
    this.panel.x = targetX;
  }

  /**
   * Clean up the inventory panel.
   */
  destroy(): void {
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
