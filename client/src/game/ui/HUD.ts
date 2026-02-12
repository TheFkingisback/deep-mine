import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { InventorySlot, EquipmentSlot } from '@shared/types';
import { ITEMS } from '@shared/items';
import { getLayerAtDepth } from '@shared/layers';

const EQUIP_EMOJIS: Record<string, string> = {
  [EquipmentSlot.SHOVEL]: '\u26CF\uFE0F',
  [EquipmentSlot.HELMET]: '\u26D1\uFE0F',
  [EquipmentSlot.VEST]: '\uD83E\uDDBA',
  [EquipmentSlot.TORCH]: '\uD83D\uDD26',
  [EquipmentSlot.ROPE]: '\uD83E\uDE62',
};

interface FloatingText {
  text: Text;
  vy: number;
  lifetime: number;
  elapsed: number;
  startAlpha: number;
}

export class HUD {
  private app: Application;
  private container: Container;

  // Top bar background
  private topBarBg: Graphics;

  // Display texts
  private goldText: Text;
  private depthText: Text;
  private layerText: Text;
  private checkpointText!: Text;

  // Items bar
  private itemsBarContainer: Container;
  private itemTexts: Text[] = [];
  private totalValueText: Text;

  // Buttons
  private surfaceButton: Container;
  private checkpointButton: Container;
  private logoutButton: Container;

  // Lives display
  private livesText: Text;

  // Equipment display
  private equipmentText: Text;

  // Match code display
  private matchCodeText: Text;

  // Gold rolling animation
  private displayedGold = 0;
  private targetGold = 0;
  private goldRollingSpeed = 0.1;

  // Floating texts
  private floatingTexts: FloatingText[] = [];

  // Button callbacks
  private onSurfaceClick: (() => void) | null = null;
  private onCheckpointClick: (() => void) | null = null;
  private onLogoutClick: (() => void) | null = null;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();

    // Semi-transparent top bar background
    this.topBarBg = new Graphics();
    this.container.addChild(this.topBarBg);

    // Create display elements
    this.goldText = this.createGoldDisplay();
    this.livesText = this.createLivesDisplay();
    this.depthText = this.createDepthDisplay();
    this.layerText = this.createLayerDisplay();
    this.equipmentText = this.createEquipmentDisplay();
    this.matchCodeText = this.createMatchCodeDisplay();

    // Create items bar
    this.itemsBarContainer = new Container();
    this.totalValueText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: '#FFD700',
        dropShadow: { color: '#000000', blur: 3, angle: Math.PI / 4, distance: 2 }
      })
    });
    this.itemsBarContainer.addChild(this.totalValueText);

    // Create buttons
    this.surfaceButton = this.createSurfaceButton();
    this.checkpointButton = this.createCheckpointButton();
    this.logoutButton = this.createLogoutButton();

    // Add all to container
    this.container.addChild(this.goldText);
    this.container.addChild(this.livesText);
    this.container.addChild(this.depthText);
    this.container.addChild(this.layerText);
    this.container.addChild(this.itemsBarContainer);
    this.container.addChild(this.equipmentText);
    this.container.addChild(this.matchCodeText);
    this.container.addChild(this.surfaceButton);
    this.container.addChild(this.checkpointButton);
    this.container.addChild(this.logoutButton);

    this.app.stage.addChild(this.container);
    this.resize(this.app.screen.width, this.app.screen.height);
  }

  private createGoldDisplay(): Text {
    const style = new TextStyle({
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: '#FFD700',
      dropShadow: { color: '#000000', blur: 4, angle: Math.PI / 4, distance: 2 }
    });
    const text = new Text({ text: 'G 0', style });
    text.x = 12;
    text.y = 8;
    return text;
  }

  private createLivesDisplay(): Text {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: '#FF4444',
      dropShadow: { color: '#000000', blur: 3, angle: Math.PI / 4, distance: 2 }
    });
    const text = new Text({ text: '❤️❤️', style });
    return text;
  }

  private createDepthDisplay(): Text {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#FFFFFF',
      dropShadow: { color: '#000000', blur: 3, angle: Math.PI / 4, distance: 2 }
    });
    return new Text({ text: 'Depth: 0', style });
  }

  private createLayerDisplay(): Text {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fill: '#AAAAAA',
      dropShadow: { color: '#000000', blur: 2, angle: Math.PI / 4, distance: 1 }
    });
    return new Text({ text: '', style });
  }

  private createEquipmentDisplay(): Text {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 11,
      fill: '#AADDFF',
      dropShadow: { color: '#000000', blur: 2, angle: Math.PI / 4, distance: 1 }
    });
    return new Text({ text: '', style });
  }

  private createMatchCodeDisplay(): Text {
    const style = new TextStyle({
      fontFamily: "'SF Mono', 'Fira Code', monospace",
      fontSize: 12,
      fill: '#F0A500',
      dropShadow: { color: '#000000', blur: 2, angle: Math.PI / 4, distance: 1 }
    });
    const text = new Text({ text: '', style });
    text.visible = false;
    return text;
  }

  private createSurfaceButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(0, 0, 140, 40, 10);
    bg.fill({ color: 0x4A90D9, alpha: 0.9 });
    bg.roundRect(0, 0, 140, 40, 10);
    bg.stroke({ width: 2, color: 0x6AB0F9, alpha: 0.5 });
    button.addChild(bg);

    const style = new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 16, fill: '#FFFFFF', fontWeight: 'bold' });
    const text = new Text({ text: '⬆ Surface', style });
    text.anchor.set(0.5);
    text.x = 70; text.y = 20;
    button.addChild(text);

    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, 140, 40, 10);
      bg.fill({ color: 0x5BA0E9, alpha: 0.95 });
      bg.roundRect(0, 0, 140, 40, 10);
      bg.stroke({ width: 2, color: 0x8BC0FF, alpha: 0.6 });
    });
    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, 140, 40, 10);
      bg.fill({ color: 0x4A90D9, alpha: 0.9 });
      bg.roundRect(0, 0, 140, 40, 10);
      bg.stroke({ width: 2, color: 0x6AB0F9, alpha: 0.5 });
    });
    button.on('pointerdown', () => { button.scale.set(0.95); });
    button.on('pointerup', () => { button.scale.set(1.0); if (this.onSurfaceClick) this.onSurfaceClick(); });

    return button;
  }

  private createCheckpointButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.visible = false;

    const bg = new Graphics();
    bg.roundRect(0, 0, 120, 36, 10);
    bg.fill({ color: 0x4CAF50, alpha: 0.9 });
    bg.roundRect(0, 0, 120, 36, 10);
    bg.stroke({ width: 2, color: 0x6CCF70, alpha: 0.5 });
    button.addChild(bg);

    const style = new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 14, fill: '#FFFFFF', fontWeight: 'bold' });
    this.checkpointText = new Text({ text: '📍 0/0', style });
    this.checkpointText.anchor.set(0.5);
    this.checkpointText.x = 60; this.checkpointText.y = 18;
    button.addChild(this.checkpointText);

    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, 120, 36, 10);
      bg.fill({ color: 0x5CBF60, alpha: 0.95 });
      bg.roundRect(0, 0, 120, 36, 10);
      bg.stroke({ width: 2, color: 0x8CDF90, alpha: 0.6 });
    });
    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, 120, 36, 10);
      bg.fill({ color: 0x4CAF50, alpha: 0.9 });
      bg.roundRect(0, 0, 120, 36, 10);
      bg.stroke({ width: 2, color: 0x6CCF70, alpha: 0.5 });
    });
    button.on('pointerdown', () => { button.scale.set(0.95); });
    button.on('pointerup', () => { button.scale.set(1.0); if (this.onCheckpointClick) this.onCheckpointClick(); });

    return button;
  }

  private createLogoutButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(0, 0, 90, 32, 8);
    bg.fill({ color: 0x442222, alpha: 0.85 });
    bg.roundRect(0, 0, 90, 32, 8);
    bg.stroke({ width: 1, color: 0x664444, alpha: 0.5 });
    button.addChild(bg);

    const style = new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: 13, fill: '#CC8888', fontWeight: 'bold' });
    const text = new Text({ text: 'Logout', style });
    text.anchor.set(0.5);
    text.x = 45; text.y = 16;
    button.addChild(text);

    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, 90, 32, 8);
      bg.fill({ color: 0x553333, alpha: 0.95 });
      bg.roundRect(0, 0, 90, 32, 8);
      bg.stroke({ width: 1, color: 0x886666, alpha: 0.6 });
      text.style.fill = '#FFAAAA';
    });
    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, 90, 32, 8);
      bg.fill({ color: 0x442222, alpha: 0.85 });
      bg.roundRect(0, 0, 90, 32, 8);
      bg.stroke({ width: 1, color: 0x664444, alpha: 0.5 });
      text.style.fill = '#CC8888';
    });
    button.on('pointerdown', () => { button.scale.set(0.95); });
    button.on('pointerup', () => { button.scale.set(1.0); if (this.onLogoutClick) this.onLogoutClick(); });

    return button;
  }

  updateItems(inventory: (InventorySlot | null)[]): void {
    this.itemTexts.forEach(t => {
      this.itemsBarContainer.removeChild(t);
      t.destroy();
    });
    this.itemTexts = [];

    let xPos = 0;
    let totalValue = 0;

    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 13,
      fill: '#FFFFFF',
      dropShadow: { color: '#000000', blur: 2, angle: Math.PI / 4, distance: 1 }
    });

    const itemMap = new Map<string, { qty: number; value: number; emoji: string; name: string }>();
    for (const slot of inventory) {
      if (!slot) continue;
      const def = ITEMS[slot.itemType];
      const existing = itemMap.get(slot.itemType);
      if (existing) {
        existing.qty += slot.quantity;
      } else {
        itemMap.set(slot.itemType, {
          qty: slot.quantity,
          value: def.value,
          emoji: def.emoji,
          name: def.name
        });
      }
    }

    for (const [, item] of itemMap) {
      const itemTotal = item.qty * item.value;
      totalValue += itemTotal;

      const txt = new Text({
        text: `${item.emoji}x${item.qty} (${itemTotal}g)`,
        style
      });
      txt.x = xPos;
      txt.y = 0;
      this.itemsBarContainer.addChild(txt);
      this.itemTexts.push(txt);
      xPos += txt.width + 12;
    }

    if (totalValue > 0) {
      this.totalValueText.text = `| Total: ${totalValue.toLocaleString()}g`;
      this.totalValueText.x = xPos;
      this.totalValueText.y = 0;
      this.totalValueText.visible = true;
    } else {
      this.totalValueText.visible = false;
    }
  }

  updateGold(newAmount: number): void {
    const oldTarget = this.targetGold;
    this.targetGold = newAmount;
    if (newAmount > oldTarget) {
      this.goldText.style.fill = '#00FF00';
      setTimeout(() => { this.goldText.style.fill = '#FFD700'; }, 200);
    } else if (newAmount < oldTarget) {
      this.goldText.style.fill = '#FF0000';
      setTimeout(() => { this.goldText.style.fill = '#FFD700'; }, 200);
    }
  }

  updateLives(lives: number): void {
    if (lives <= 0) {
      this.livesText.text = '💀';
      this.livesText.style.fill = '#666666';
    } else {
      this.livesText.text = '❤️'.repeat(lives);
      this.livesText.style.fill = '#FF4444';
    }
  }

  updateDepth(depth: number): void {
    this.updatePosition(0, depth);
  }

  updatePosition(x: number, y: number): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (iy <= 1) {
      this.depthText.text = 'Surface';
      this.depthText.style.fill = '#88FF88';
      this.layerText.text = '';
    } else {
      this.depthText.text = `X: ${ix}  Y: ${iy}`;
      this.depthText.style.fill = '#FFFFFF';
      const layer = getLayerAtDepth(iy);
      this.layerText.text = layer.displayName;
      this.layerText.style.fill = layer.ambientColor;
    }
    // Re-align right-side texts after content change
    this.realignRightTexts();
  }

  updateEquipment(equipment: Record<string, number>): void {
    const parts: string[] = [];
    const order = [EquipmentSlot.SHOVEL, EquipmentSlot.HELMET, EquipmentSlot.VEST, EquipmentSlot.TORCH, EquipmentSlot.ROPE];
    for (const slot of order) {
      const tier = equipment[slot] ?? 1;
      const emoji = EQUIP_EMOJIS[slot] ?? '?';
      parts.push(`${emoji}T${tier}`);
    }
    this.equipmentText.text = parts.join('  ');
  }

  setMatchCode(code: string): void {
    if (code) {
      this.matchCodeText.text = `Code: ${code}`;
      this.matchCodeText.visible = true;
    } else {
      this.matchCodeText.visible = false;
    }
    this.realignRightTexts();
  }

  private realignRightTexts(): void {
    const width = this.app.screen.width;
    this.depthText.x = width - this.depthText.width - 12;
    this.layerText.x = width - this.layerText.width - 12;
    this.matchCodeText.x = width - this.matchCodeText.width - 12;
  }

  updateInventory(_used: number, _max: number): void {
    // No-op: replaced by items bar
  }

  updateCheckpoints(current: number, max: number): void {
    this.checkpointText.text = `📍 ${current}/${max}`;
    this.checkpointButton.visible = max > 0;
  }

  showFloatingText(text: string, screenX: number, screenY: number, color: string): void {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif', fontSize: 18, fontWeight: 'bold', fill: color,
      dropShadow: { color: '#000000', blur: 4, angle: Math.PI / 4, distance: 2 }
    });
    const floatingText = new Text({ text, style });
    floatingText.anchor.set(0.5);
    floatingText.x = screenX;
    floatingText.y = screenY;
    this.container.addChild(floatingText);
    this.floatingTexts.push({ text: floatingText, vy: -1.5, lifetime: 800, elapsed: 0, startAlpha: 1.0 });
  }

  setButtonVisibility(button: 'surface' | 'checkpoint' | 'inventory' | 'logout', visible: boolean): void {
    switch (button) {
      case 'surface': this.surfaceButton.visible = visible; break;
      case 'checkpoint': this.checkpointButton.visible = visible; break;
      case 'logout': this.logoutButton.visible = visible; break;
    }
  }

  setButtonCallback(button: 'surface' | 'checkpoint' | 'inventory' | 'logout', callback: () => void): void {
    switch (button) {
      case 'surface': this.onSurfaceClick = callback; break;
      case 'checkpoint': this.onCheckpointClick = callback; break;
      case 'logout': this.onLogoutClick = callback; break;
    }
  }

  update(deltaMs: number): void {
    // Gold rolling
    if (Math.abs(this.targetGold - this.displayedGold) > 0.1) {
      this.displayedGold += (this.targetGold - this.displayedGold) * this.goldRollingSpeed;
      this.goldText.text = `G ${Math.floor(this.displayedGold).toLocaleString()}`;
    } else {
      this.displayedGold = this.targetGold;
      this.goldText.text = `G ${Math.floor(this.displayedGold).toLocaleString()}`;
    }

    // Floating texts
    const toRemove: number[] = [];
    this.floatingTexts.forEach((ft, index) => {
      ft.elapsed += deltaMs;
      ft.text.y += ft.vy;
      ft.text.alpha = ft.startAlpha * (1 - ft.elapsed / ft.lifetime);
      if (ft.elapsed >= ft.lifetime) toRemove.push(index);
    });
    toRemove.reverse().forEach(index => {
      const ft = this.floatingTexts[index];
      this.container.removeChild(ft.text);
      ft.text.destroy();
      this.floatingTexts.splice(index, 1);
    });
  }

  resize(width: number, height: number): void {
    // Top bar background (expanded for 3 rows: gold/lives, items, equipment)
    this.topBarBg.clear();
    this.topBarBg.rect(0, 0, width, 74);
    this.topBarBg.fill({ color: 0x000000, alpha: 0.4 });

    this.goldText.x = 12;
    this.goldText.y = 6;

    // Lives next to gold
    this.livesText.x = 120;
    this.livesText.y = 7;

    this.depthText.x = width - this.depthText.width - 12;
    this.depthText.y = 6;

    // Layer name below depth
    this.layerText.x = width - this.layerText.width - 12;
    this.layerText.y = 26;

    // Match code below layer name
    this.matchCodeText.x = width - this.matchCodeText.width - 12;
    this.matchCodeText.y = 46;

    // Items bar (row 2)
    this.itemsBarContainer.x = 12;
    this.itemsBarContainer.y = 32;

    // Equipment bar (row 3)
    this.equipmentText.x = 12;
    this.equipmentText.y = 54;

    // Bottom-left: Surface button
    this.surfaceButton.x = 10;
    this.surfaceButton.y = height - 54;

    // Bottom-center: Checkpoint button
    this.checkpointButton.x = width / 2 - 60;
    this.checkpointButton.y = height - 50;

    // Bottom-right: Logout button
    this.logoutButton.x = width - 100;
    this.logoutButton.y = height - 46;
  }

  destroy(): void {
    this.floatingTexts.forEach(ft => { this.container.removeChild(ft.text); ft.text.destroy(); });
    this.floatingTexts = [];
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
