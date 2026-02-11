import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { PlayerState, EquipmentSlot, EquipmentTier } from '@shared/types';
import { EQUIPMENT, getEquipmentPrice, getNextTier, canBuyEquipment } from '@shared/equipment';
import { processEquipmentPurchase, processInventoryUpgrade } from '@shared/economy';
import { INVENTORY_UPGRADE_SLOTS, INVENTORY_UPGRADE_PRICES } from '@shared/constants';
import { audioManager } from '../../audio/AudioManager';

type TabType = 'shovel' | 'helmet' | 'vest' | 'torch' | 'rope' | 'backpack';

/**
 * ShopPanel allows players to purchase equipment upgrades.
 * Features tabbed interface for different equipment categories.
 */
export class ShopPanel {
  private app: Application;
  private container: Container;
  private background: Graphics;
  private panel: Container;
  private isOpen = false;

  private playerState: PlayerState | null = null;
  private currentTab: TabType = 'shovel';
  private onBuyCallback: ((result: any) => void) | null = null;

  private readonly tabs: TabType[] = ['shovel', 'helmet', 'vest', 'torch', 'rope', 'backpack'];
  private readonly tabLabels: Record<TabType, string> = {
    shovel: 'Shovel',
    helmet: 'Helmet',
    vest: 'Vest',
    torch: 'Torch',
    rope: 'Rope',
    backpack: 'Backpack'
  };

  constructor(app: Application, onBuy: (result: any) => void) {
    this.app = app;
    this.onBuyCallback = onBuy;

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
   * Open the shop panel.
   */
  open(playerState: PlayerState): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.playerState = playerState;
    this.container.visible = true;
    this.currentTab = 'shovel';

    this.populatePanel();
  }

  /**
   * Close the shop panel.
   */
  close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.container.visible = false;
    this.playerState = null;
  }

  /**
   * Switch to a different tab.
   */
  private switchTab(tab: TabType): void {
    this.currentTab = tab;
    this.populatePanel();
  }

  /**
   * Refresh panel after purchase.
   */
  refreshAfterPurchase(playerState: PlayerState): void {
    this.playerState = playerState;
    this.populatePanel();
  }

  /**
   * Populate panel with content.
   */
  private populatePanel(): void {
    if (!this.playerState) return;

    this.panel.removeChildren();

    const panelWidth = 550;
    const panelHeight = 500;
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
    const title = new Text({ text: 'EQUIPMENT SHOP', style: titleStyle });
    title.anchor.set(0.5, 0);
    title.x = panelWidth / 2;
    title.y = 15;
    this.panel.addChild(title);

    // Close button
    const closeButton = this.createCloseButton();
    closeButton.x = panelWidth - 35;
    closeButton.y = 15;
    this.panel.addChild(closeButton);

    // Tab bar
    const tabBar = this.createTabBar(panelWidth);
    tabBar.y = 50;
    this.panel.addChild(tabBar);

    // Content area
    const contentY = 90;
    const contentHeight = panelHeight - contentY - 10;

    if (this.currentTab === 'backpack') {
      const backpackContent = this.createBackpackContent(panelWidth, contentHeight);
      backpackContent.y = contentY;
      this.panel.addChild(backpackContent);
    } else {
      const equipmentContent = this.createEquipmentContent(this.currentTab, panelWidth, contentHeight);
      equipmentContent.y = contentY;
      this.panel.addChild(equipmentContent);
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
   * Create tab bar.
   */
  private createTabBar(panelWidth: number): Container {
    const tabBar = new Container();
    const tabWidth = 80;
    const tabHeight = 32;
    const startX = (panelWidth - tabWidth * this.tabs.length) / 2;

    this.tabs.forEach((tab, index) => {
      const tabButton = new Container();
      tabButton.eventMode = 'static';
      tabButton.cursor = 'pointer';

      const isActive = this.currentTab === tab;
      const bgColor = isActive ? 0x4A90D9 : 0x333333;

      const bg = new Graphics();
      bg.roundRect(0, 0, tabWidth - 2, tabHeight, { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 } as any);
      bg.fill(bgColor);
      tabButton.addChild(bg);

      const textStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        fill: isActive ? '#FFFFFF' : '#888888'
      });
      const label = new Text({ text: this.tabLabels[tab], style: textStyle });
      label.anchor.set(0.5);
      label.x = (tabWidth - 2) / 2;
      label.y = tabHeight / 2;
      tabButton.addChild(label);

      tabButton.x = startX + index * tabWidth;

      tabButton.on('pointerup', () => {
        this.switchTab(tab);
      });

      tabBar.addChild(tabButton);
    });

    return tabBar;
  }

  /**
   * Create equipment content for a specific slot.
   */
  private createEquipmentContent(slot: TabType, panelWidth: number, contentHeight: number): Container {
    if (!this.playerState) return new Container();

    const content = new Container();
    const equipSlot = slot as EquipmentSlot;
    const currentTier = this.playerState.equipment[equipSlot];

    // Create tier rows (all 7 tiers)
    for (let tier = 1; tier <= 7; tier++) {
      const tierRow = this.createTierRow(equipSlot, tier as EquipmentTier, currentTier, panelWidth);
      tierRow.y = (tier - 1) * 55;
      content.addChild(tierRow);
    }

    return content;
  }

  /**
   * Create a tier row.
   */
  private createTierRow(slot: EquipmentSlot, tier: EquipmentTier, currentTier: EquipmentTier, panelWidth: number): Container {
    if (!this.playerState) return new Container();

    const row = new Container();
    const equipment = EQUIPMENT[slot][tier];

    const isEquipped = tier === currentTier;
    const isNext = tier === currentTier + 1;
    const isLocked = tier > currentTier + 1;

    // Row background
    const bg = new Graphics();
    bg.rect(12, 0, panelWidth - 24, 50);

    if (isEquipped) {
      bg.fill({ color: 0x1B3D1B, alpha: 0.8 }); // Dark green
    } else if (isNext) {
      bg.fill({ color: 0x3D3520, alpha: 0.8 }); // Dark gold
    } else {
      bg.fill({ color: 0x1A1A1A, alpha: 0.8 }); // Dark gray
    }

    row.addChild(bg);

    // Tier circle
    const tierCircle = new Graphics();
    tierCircle.circle(32, 25, 14);
    tierCircle.fill(isLocked ? 0x333333 : 0x4A90D9);
    row.addChild(tierCircle);

    const tierStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const tierText = new Text({ text: isLocked ? '🔒' : `T${tier}`, style: tierStyle });
    tierText.anchor.set(0.5);
    tierText.x = 32;
    tierText.y = 25;
    row.addChild(tierText);

    // Equipment name
    const nameStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: isLocked ? '#555555' : '#FFFFFF'
    });
    const name = new Text({ text: equipment.name, style: nameStyle });
    name.x = 55;
    name.y = 10;
    row.addChild(name);

    // Stats
    const statsText = this.getStatsText(slot, tier, currentTier, isNext);
    const statsStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fill: isLocked ? '#555555' : '#00DDFF'
    });
    const stats = new Text({ text: statsText, style: statsStyle });
    stats.x = 55;
    stats.y = 28;
    row.addChild(stats);

    // Right side: Badge or Buy button
    if (isEquipped) {
      // Equipped badge
      const badgeStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#00FF00'
      });
      const badge = new Text({ text: '✓ EQUIPPED', style: badgeStyle });
      badge.anchor.set(1, 0.5);
      badge.x = panelWidth - 24;
      badge.y = 25;
      row.addChild(badge);
    } else if (isNext) {
      // Price and buy button
      const price = equipment.price;
      const canAfford = this.playerState.gold >= price;

      const priceStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 12,
        fill: '#FFD700'
      });
      const priceText = new Text({ text: `${price.toLocaleString()}G`, style: priceStyle });
      priceText.anchor.set(1, 0);
      priceText.x = panelWidth - 100;
      priceText.y = 12;
      row.addChild(priceText);

      // "You have" text
      const youHaveStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 10,
        fill: canAfford ? '#00FF00' : '#FF0000'
      });
      const youHave = new Text({ text: `You have: ${this.playerState.gold.toLocaleString()}G`, style: youHaveStyle });
      youHave.anchor.set(1, 0);
      youHave.x = panelWidth - 100;
      youHave.y = 30;
      row.addChild(youHave);

      // Buy button
      const buyButton = this.createBuyButton(canAfford);
      buyButton.x = panelWidth - 84;
      buyButton.y = 13;

      if (canAfford) {
        buyButton.on('pointerup', () => this.handleBuyEquipment(slot));
      }

      row.addChild(buyButton);
    } else if (isLocked) {
      // Price shown but locked
      const priceStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 12,
        fill: '#555555'
      });
      const priceText = new Text({ text: `${equipment.price.toLocaleString()}G`, style: priceStyle });
      priceText.anchor.set(1, 0.5);
      priceText.x = panelWidth - 24;
      priceText.y = 25;
      row.addChild(priceText);
    }

    return row;
  }

  /**
   * Get stats text for equipment.
   */
  private getStatsText(slot: EquipmentSlot, tier: EquipmentTier, currentTier: EquipmentTier, isNext: boolean): string {
    const equipment = EQUIPMENT[slot][tier];
    const stats = equipment.stats;

    if (slot === EquipmentSlot.SHOVEL) {
      const damage = stats.damage;
      if (isNext) {
        const currentDamage = EQUIPMENT[slot][currentTier].stats.damage;
        return `Damage: ${currentDamage} → ${damage}`;
      }
      return `Damage: ${damage}`;
    } else if (slot === EquipmentSlot.HELMET) {
      const maxDepth = stats.maxDepth === Infinity ? 'Unlimited' : stats.maxDepth;
      if (isNext) {
        const currentMaxDepth = EQUIPMENT[slot][currentTier].stats.maxDepth;
        const currentText = currentMaxDepth === Infinity ? 'Unlimited' : currentMaxDepth;
        return `Max Depth: ${currentText} → ${maxDepth}`;
      }
      return `Max Depth: ${maxDepth}`;
    } else if (slot === EquipmentSlot.VEST) {
      const bonusSlots = stats.bonusSlots;
      const protection = Math.round(stats.protection * 100);
      if (isNext) {
        const current = EQUIPMENT[slot][currentTier].stats;
        const currentSlots = current.bonusSlots;
        const currentProt = Math.round(current.protection * 100);
        return `Bonus Slots: +${currentSlots} → +${bonusSlots}, Protection: ${currentProt}% → ${protection}%`;
      }
      return `Bonus Slots: +${bonusSlots}, Protection: ${protection}%`;
    } else if (slot === EquipmentSlot.TORCH) {
      const radius = stats.radius;
      if (isNext) {
        const currentRadius = EQUIPMENT[slot][currentTier].stats.radius;
        return `Light Radius: ${currentRadius} → ${radius} blocks`;
      }
      return `Light Radius: ${radius} blocks`;
    } else if (slot === EquipmentSlot.ROPE) {
      const speed = stats.speed === 999 ? 'Instant' : stats.speed;
      const checkpoints = stats.checkpoints;
      if (isNext) {
        const current = EQUIPMENT[slot][currentTier].stats;
        const currentSpeed = current.speed === 999 ? 'Instant' : current.speed;
        return `Speed: ${currentSpeed} → ${speed}, Checkpoints: ${current.checkpoints} → ${checkpoints}`;
      }
      return `Speed: ${speed}, Checkpoints: ${checkpoints}`;
    }

    return '';
  }

  /**
   * Create buy button.
   */
  private createBuyButton(canAfford: boolean): Container {
    const button = new Container();
    button.eventMode = canAfford ? 'static' : 'none';
    button.cursor = canAfford ? 'pointer' : 'default';

    const bg = new Graphics();
    bg.roundRect(0, 0, 70, 24, 4);
    bg.fill(canAfford ? 0xFFD700 : 0x555555);
    button.addChild(bg);

    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      fill: canAfford ? '#000000' : '#888888'
    });
    const label = new Text({ text: 'BUY', style: textStyle });
    label.anchor.set(0.5);
    label.x = 35;
    label.y = 12;
    button.addChild(label);

    if (canAfford) {
      button.on('pointerover', () => {
        button.scale.set(1.05);
      });

      button.on('pointerout', () => {
        button.scale.set(1.0);
      });

      button.on('pointerdown', () => {
        button.scale.set(0.95);
      });
    }

    return button;
  }

  /**
   * Create backpack content.
   */
  private createBackpackContent(panelWidth: number, contentHeight: number): Container {
    if (!this.playerState) return new Container();

    const content = new Container();
    const currentLevel = this.playerState.inventoryUpgradeLevel;
    const currentSlots = INVENTORY_UPGRADE_SLOTS[currentLevel];

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const title = new Text({ text: 'Inventory Capacity Upgrades', style: titleStyle });
    title.x = 20;
    title.y = 20;
    content.addChild(title);

    // Current level
    const currentStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fill: '#00FF00'
    });
    const current = new Text({ text: `Current: ${currentSlots} slots (Level ${currentLevel})`, style: currentStyle });
    current.x = 20;
    current.y = 50;
    content.addChild(current);

    // Next upgrade or max level
    if (currentLevel < INVENTORY_UPGRADE_SLOTS.length - 1) {
      const nextLevel = currentLevel + 1;
      const nextSlots = INVENTORY_UPGRADE_SLOTS[nextLevel];
      const price = INVENTORY_UPGRADE_PRICES[nextLevel];
      const bonus = nextSlots - currentSlots;
      const canAfford = this.playerState.gold >= price;

      const nextStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        fill: '#FFFFFF'
      });
      const next = new Text({ text: `Next: +${bonus} slots for ${price.toLocaleString()}G`, style: nextStyle });
      next.x = 20;
      next.y = 80;
      content.addChild(next);

      // You have text
      const youHaveStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 12,
        fill: canAfford ? '#00FF00' : '#FF0000'
      });
      const youHave = new Text({ text: `You have: ${this.playerState.gold.toLocaleString()}G`, style: youHaveStyle });
      youHave.x = 20;
      youHave.y = 110;
      content.addChild(youHave);

      // Buy button
      const buyButton = this.createBuyButton(canAfford);
      buyButton.x = 20;
      buyButton.y = 140;

      if (canAfford) {
        buyButton.on('pointerup', () => this.handleBuyInventoryUpgrade());
      }

      content.addChild(buyButton);
    } else {
      const maxStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: '#FFD700'
      });
      const max = new Text({ text: '✓ Maximum capacity reached!', style: maxStyle });
      max.x = 20;
      max.y = 80;
      content.addChild(max);
    }

    return content;
  }

  /**
   * Handle equipment purchase.
   */
  private handleBuyEquipment(slot: EquipmentSlot): void {
    if (!this.playerState) return;

    const result = processEquipmentPurchase(this.playerState, slot);

    if (result.success && result.newTier && result.newGold !== undefined) {
      // Update player state
      this.playerState.equipment[slot] = result.newTier;
      this.playerState.gold = result.newGold;

      // Play SFX
      audioManager.playSFX('buy_equip', 0.5);

      // Callback
      if (this.onBuyCallback) {
        this.onBuyCallback(result);
      }

      // Refresh panel
      this.populatePanel();
    } else {
      // Show error
      console.error('Purchase failed:', result.reason);
    }
  }

  /**
   * Handle inventory upgrade purchase.
   */
  private handleBuyInventoryUpgrade(): void {
    if (!this.playerState) return;

    const result = processInventoryUpgrade(this.playerState);

    if (result.success && result.newSlots && result.newLevel !== undefined && result.newGold !== undefined) {
      // Update player state
      this.playerState.maxInventorySlots = result.newSlots;
      this.playerState.inventoryUpgradeLevel = result.newLevel;
      this.playerState.gold = result.newGold;

      // Play SFX
      audioManager.playSFX('buy_equip', 0.5);

      // Callback
      if (this.onBuyCallback) {
        this.onBuyCallback(result);
      }

      // Refresh panel
      this.populatePanel();
    } else {
      // Show error
      console.error('Purchase failed:', result.reason);
    }
  }

  /**
   * Update (for animations if needed).
   */
  update(deltaMs: number): void {
    // Placeholder for future animations
  }

  /**
   * Clean up the panel.
   */
  destroy(): void {
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
