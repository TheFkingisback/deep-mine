import { Application, Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js';
import { PlayerState, InventorySlot, ItemType } from '@shared/types';
import { ITEMS } from '@shared/items';
import { processSell, calculateSellValue } from '@shared/economy';
import { removeItem } from '@shared/inventory';
import { audioManager } from '../../audio/AudioManager';

/**
 * Coin particle for sell animations.
 */
interface CoinParticle {
  graphics: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  elapsed: number;
}

/**
 * SellPanel allows players to sell inventory items for gold.
 * Features coin animations and integration with the economy system.
 */
export class SellPanel {
  private app: Application;
  private container: Container;
  private background: Graphics;
  private panel: Container;
  private isOpen = false;

  private playerState: PlayerState | null = null;
  private onSellCallback: ((result: any) => void) | null = null;

  private coinParticles: CoinParticle[] = [];

  // Scroll state
  private itemListContainer: Container | null = null;
  private scrollMask: Graphics | null = null;
  private scrollY = 0;
  private maxScrollY = 0;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;

  private static readonly ITEM_LIST_TOP = 60;
  private static readonly ITEM_ROW_HEIGHT = 50;
  private static readonly SCROLL_SPEED = 30;

  constructor(app: Application, onSell: (result: any) => void) {
    this.app = app;
    this.onSellCallback = onSell;

    // Create main container
    this.container = new Container();
    this.container.visible = false;

    // Background overlay
    this.background = new Graphics();
    this.background.eventMode = 'static';
    this.background.on('pointerdown', () => this.close());
    this.container.addChild(this.background);

    // Panel
    this.panel = new Container();
    this.container.addChild(this.panel);

    // Add to stage
    this.app.stage.addChild(this.container);

    this.renderBackground();
  }

  /**
   * Render dark background overlay.
   */
  private renderBackground(): void {
    this.background.clear();
    this.background.rect(0, 0, this.app.screen.width, this.app.screen.height);
    this.background.fill({ color: 0x000000, alpha: 0.5 });
  }

  /**
   * Open the sell panel.
   */
  open(playerState: PlayerState): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.playerState = playerState;
    this.container.visible = true;

    this.wheelHandler = (e: WheelEvent) => {
      if (!this.isOpen || !this.itemListContainer || this.maxScrollY <= 0) return;
      e.preventDefault();
      this.scrollY = Math.min(this.maxScrollY, Math.max(0, this.scrollY + (e.deltaY > 0 ? SellPanel.SCROLL_SPEED : -SellPanel.SCROLL_SPEED)));
      this.itemListContainer.y = SellPanel.ITEM_LIST_TOP - this.scrollY;
    };
    window.addEventListener('wheel', this.wheelHandler, { passive: false });

    this.populatePanel();
  }

  /**
   * Close the sell panel.
   */
  close(): void {
    if (!this.isOpen) return;

    if (this.wheelHandler) {
      window.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    this.scrollY = 0;
    this.maxScrollY = 0;
    this.itemListContainer = null;
    this.scrollMask = null;

    this.isOpen = false;
    this.container.visible = false;
    this.playerState = null;
  }

  /**
   * Populate panel with inventory items.
   */
  private populatePanel(): void {
    if (!this.playerState) return;

    this.panel.removeChildren();

    const panelWidth = 500;
    const panelHeight = 450;
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = (this.app.screen.height - panelHeight) / 2;

    // Panel background
    const bg = new Graphics();
    bg.roundRect(0, 0, panelWidth, panelHeight, 12);
    bg.fill(0x1E1E2E);
    this.panel.addChild(bg);

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const title = new Text({ text: 'SELL ITEMS', style: titleStyle });
    title.anchor.set(0.5, 0);
    title.x = panelWidth / 2;
    title.y = 15;
    this.panel.addChild(title);

    // Close button
    const closeButton = this.createCloseButton();
    closeButton.x = panelWidth - 35;
    closeButton.y = 15;
    this.panel.addChild(closeButton);

    // Filter non-null inventory items
    const items = this.playerState.inventory.filter(slot => slot !== null) as InventorySlot[];

    // Calculate total value
    const itemsToSell = items.map(slot => ({ itemType: slot.itemType, quantity: slot.quantity }));
    const totalValue = calculateSellValue(itemsToSell);

    // Item list area
    let yOffset = 60;

    if (items.length === 0) {
      const emptyStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        fill: '#888888'
      });
      const emptyText = new Text({ text: 'Nothing to sell!', style: emptyStyle });
      emptyText.anchor.set(0.5);
      emptyText.x = panelWidth / 2;
      emptyText.y = panelHeight / 2;
      this.panel.addChild(emptyText);
    } else {
      const scrollAreaHeight = panelHeight - 100 - SellPanel.ITEM_LIST_TOP;
      const itemListContainer = new Container();

      items.forEach((slot, index) => {
        const itemRow = this.createItemRow(slot, panelWidth);
        itemRow.y = index * SellPanel.ITEM_ROW_HEIGHT;
        itemListContainer.addChild(itemRow);
      });

      const totalContentHeight = items.length * SellPanel.ITEM_ROW_HEIGHT;
      this.maxScrollY = Math.max(0, totalContentHeight - scrollAreaHeight);
      this.scrollY = 0;

      // Mask to clip item list to scroll area
      this.scrollMask = new Graphics();
      this.scrollMask.rect(0, SellPanel.ITEM_LIST_TOP, panelWidth, scrollAreaHeight);
      this.scrollMask.fill(0xFFFFFF);
      this.panel.addChild(this.scrollMask);

      itemListContainer.y = SellPanel.ITEM_LIST_TOP;
      itemListContainer.mask = this.scrollMask;
      this.itemListContainer = itemListContainer;
      this.panel.addChild(itemListContainer);

      // Bottom section divider
      const dividerY = panelHeight - 100;
      const divider = new Graphics();
      divider.rect(20, dividerY, panelWidth - 40, 1);
      divider.fill(0x333333);
      this.panel.addChild(divider);

      // Total value
      const totalStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 16,
        fill: '#FFFFFF'
      });
      const totalText = new Text({ text: `Total value: ${totalValue.toLocaleString()} G`, style: totalStyle });
      totalText.anchor.set(1, 0);
      totalText.x = panelWidth - 24;
      totalText.y = dividerY + 10;
      this.panel.addChild(totalText);

      // SELL ALL button
      const sellAllButton = this.createSellAllButton(panelWidth);
      sellAllButton.y = panelHeight - 62;
      sellAllButton.on('pointerup', () => this.handleSellAll());
      this.panel.addChild(sellAllButton);
    }

    this.panel.x = panelX;
    this.panel.y = panelY;
  }

  /**
   * Create close button.
   */
  private createCloseButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.circle(12, 12, 12);
    bg.fill({ color: 0x333333 });
    button.addChild(bg);

    const xStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const x = new Text({ text: '×', style: xStyle });
    x.anchor.set(0.5);
    x.x = 12;
    x.y = 12;
    button.addChild(x);

    button.on('pointerover', () => {
      bg.clear();
      bg.circle(12, 12, 12);
      bg.fill({ color: 0xFF0000 });
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.circle(12, 12, 12);
      bg.fill({ color: 0x333333 });
    });

    button.on('pointerup', () => {
      this.close();
    });

    return button;
  }

  /**
   * Create a single item row.
   */
  private createItemRow(slot: InventorySlot, panelWidth: number): Container {
    const row = new Container();
    const itemDef = ITEMS[slot.itemType];
    const unitPrice = itemDef.value;
    const totalValue = unitPrice * slot.quantity;

    // Row background
    const bg = new Graphics();
    bg.rect(12, 0, panelWidth - 24, 44);
    bg.fill({ color: 0x2A2A3A, alpha: 0.5 });
    row.addChild(bg);

    // Bottom border
    const border = new Graphics();
    border.rect(12, 43, panelWidth - 24, 1);
    border.fill(0x333333);
    row.addChild(border);

    // Item emoji
    const emojiStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 20
    });
    const emoji = new Text({ text: itemDef.emoji, style: emojiStyle });
    emoji.x = 24;
    emoji.y = 12;
    row.addChild(emoji);

    // Item name
    const nameStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fill: '#FFFFFF'
    });
    const name = new Text({ text: itemDef.name, style: nameStyle });
    name.x = 60;
    name.y = 8;
    row.addChild(name);

    // Quantity
    const qtyStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fill: '#888888'
    });
    const qty = new Text({ text: `x${slot.quantity}`, style: qtyStyle });
    qty.x = 60;
    qty.y = 24;
    row.addChild(qty);

    // Unit price
    const unitPriceStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fill: '#AA8800'
    });
    const unitPriceText = new Text({ text: `${unitPrice}G ea.`, style: unitPriceStyle });
    unitPriceText.x = 110;
    unitPriceText.y = 24;
    row.addChild(unitPriceText);

    // Total value
    const valueStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#FFD700'
    });
    const value = new Text({ text: `${totalValue.toLocaleString()} G`, style: valueStyle });
    value.anchor.set(0, 0.5);
    value.x = panelWidth - 130;
    value.y = 22;
    row.addChild(value);

    // Sell button
    const sellButton = this.createSmallButton('SELL');
    sellButton.x = panelWidth - 74;
    sellButton.y = 10;
    sellButton.on('pointerup', () => this.handleSellItem(slot.itemType, slot.quantity, sellButton));
    row.addChild(sellButton);

    return row;
  }

  /**
   * Create small sell button.
   */
  private createSmallButton(text: string): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(0, 0, 50, 24, 4);
    bg.fill(0xFFD700);
    button.addChild(bg);

    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      fill: '#000000'
    });
    const label = new Text({ text, style: textStyle });
    label.anchor.set(0.5);
    label.x = 25;
    label.y = 12;
    button.addChild(label);

    button.on('pointerover', () => {
      button.scale.set(1.05);
    });

    button.on('pointerout', () => {
      button.scale.set(1.0);
    });

    button.on('pointerdown', () => {
      button.scale.set(0.95);
    });

    return button;
  }

  /**
   * Create SELL ALL button.
   */
  private createSellAllButton(panelWidth: number): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(24, 0, panelWidth - 48, 50, 8);
    bg.fill(0xFFD700);
    button.addChild(bg);

    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: '#000000'
    });
    const label = new Text({ text: '💰 SELL ALL', style: textStyle });
    label.anchor.set(0.5);
    label.x = panelWidth / 2;
    label.y = 25;
    button.addChild(label);

    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(24, 0, panelWidth - 48, 50, 8);
      bg.fill(0xFFE044);
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(24, 0, panelWidth - 48, 50, 8);
      bg.fill(0xFFD700);
    });

    button.on('pointerdown', () => {
      button.scale.set(0.98);
    });

    button.on('pointerup', () => {
      button.scale.set(1.0);
    });

    return button;
  }

  /**
   * Handle selling a single item type.
   */
  private handleSellItem(itemType: string, quantity: number, button: Container): void {
    if (!this.playerState) return;

    // Process sell
    const result = processSell(this.playerState, [{ itemType: itemType as any, quantity }]);

    if (result.success) {
      // Update player state (remove items)
      removeItem(this.playerState.inventory, itemType as ItemType, quantity);

      // Spawn coin animation from button position
      const screenPos = button.toGlobal({ x: 25, y: 12 });
      this.spawnCoinParticles(screenPos.x, screenPos.y, 3);

      // Play sell SFX
      audioManager.playSFX('sell_coin', 0.5);

      // Update gold and refresh panel
      if (this.onSellCallback) {
        this.onSellCallback(result);
      }

      // Refresh panel
      setTimeout(() => {
        if (this.isOpen) {
          this.populatePanel();
        }
      }, 100);
    }
  }

  /**
   * Handle selling all items.
   */
  private handleSellAll(): void {
    if (!this.playerState) return;

    // Process sell all
    const result = processSell(this.playerState, 'all');

    if (result.success) {
      // Clear inventory
      for (let i = 0; i < this.playerState.inventory.length; i++) {
        this.playerState.inventory[i] = null;
      }

      // Spawn coin animation from panel center
      const centerX = this.app.screen.width / 2;
      const centerY = this.app.screen.height / 2;
      this.spawnCoinParticles(centerX, centerY, 8);

      // Play SFX
      console.log('🔊 sell_coin SFX');

      // Update gold
      if (this.onSellCallback) {
        this.onSellCallback(result);
      }

      // Close after animation
      setTimeout(() => {
        this.close();
      }, 800);
    }
  }

  /**
   * Spawn coin particles for animation.
   */
  private spawnCoinParticles(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const coin = new Graphics();
      coin.circle(0, 0, 4);
      coin.fill(0xFFD700);
      this.container.addChild(coin);

      // Random arc upward
      const angle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 3;
      const speed = 2 + Math.random() * 2;

      this.coinParticles.push({
        graphics: coin,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        lifetime: 800,
        elapsed: 0
      });
    }
  }

  /**
   * Update coin particle animations.
   */
  update(deltaMs: number): void {
    const toRemove: number[] = [];

    this.coinParticles.forEach((particle, index) => {
      particle.elapsed += deltaMs;

      // Update position
      particle.x += particle.vx * deltaMs / 16;
      particle.y += particle.vy * deltaMs / 16;
      particle.vy += 0.15; // Gravity

      particle.graphics.x = particle.x;
      particle.graphics.y = particle.y;

      // Fade out
      const progress = particle.elapsed / particle.lifetime;
      particle.graphics.alpha = 1 - progress;

      // Mark for removal
      if (particle.elapsed >= particle.lifetime) {
        toRemove.push(index);
      }
    });

    // Remove dead particles
    toRemove.reverse().forEach(index => {
      const particle = this.coinParticles[index];
      this.container.removeChild(particle.graphics);
      particle.graphics.destroy();
      this.coinParticles.splice(index, 1);
    });
  }

  /**
   * Clean up the panel.
   */
  destroy(): void {
    if (this.wheelHandler) {
      window.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }

    // Clean up particles
    this.coinParticles.forEach(particle => {
      this.container.removeChild(particle.graphics);
      particle.graphics.destroy();
    });
    this.coinParticles = [];

    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
