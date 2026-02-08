import { Application, Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js';
import { PlayerState } from '@shared/types';
import { PlayerRenderer } from '../renderer/PlayerRenderer';
import { HUD } from '../ui/HUD';
import { SellPanel } from '../ui/SellPanel';
import { ShopPanel } from '../ui/ShopPanel';
import { CheckpointPanel } from '../ui/CheckpointPanel';

/**
 * SurfaceScene represents the overworld where players sell items and buy equipment.
 * Features a Pixar-style environment with sky, clouds, grass, mine entrance, and shops.
 */
export class SurfaceScene {
  private app: Application;
  private container: Container;
  private playerState: PlayerState;

  // Renderers
  private playerRenderer: PlayerRenderer;
  private hud: HUD;
  private sellPanel: SellPanel;
  private shopPanel: ShopPanel;
  private checkpointPanel: CheckpointPanel;

  // Scene elements
  private background: Graphics;
  private clouds: Graphics[] = [];
  private cloudPositions: { x: number; y: number; speed: number }[] = [];
  private sun: Graphics;
  private ground: Graphics;
  private mineEntrance: Container;
  private sellStand: Container;
  private shopStand: Container;

  // Animation
  private cloudTimer = 0;
  private birdTimer = 0;
  private grassSway = 0;

  // Callbacks
  private onDescendClick: (() => void) | null = null;
  private onDescendToDepth: ((depth: number) => void) | null = null;
  private onSellClick: (() => void) | null = null;
  private onShopClick: (() => void) | null = null;

  constructor(app: Application, playerState: PlayerState) {
    this.app = app;
    this.playerState = playerState;

    // Create main container
    this.container = new Container();
    this.app.stage.addChild(this.container);

    // Create background elements
    this.background = new Graphics();
    this.sun = new Graphics();
    this.ground = new Graphics();

    // Create interactive elements
    this.mineEntrance = new Container();
    this.sellStand = new Container();
    this.shopStand = new Container();

    // Create renderers
    this.playerRenderer = new PlayerRenderer(this.container);
    this.hud = new HUD(this.app);

    // Create panels
    this.sellPanel = new SellPanel(this.app, (result) => {
      // Update player state after sell
      this.playerState.gold = result.newGold;
      this.hud.updateGold(this.playerState.gold);
      const usedSlots = this.playerState.inventory.filter(slot => slot !== null).length;
      this.hud.updateInventory(usedSlots, this.playerState.maxInventorySlots);
    });

    this.shopPanel = new ShopPanel(this.app, (result) => {
      // Update player state after purchase
      this.playerState.gold = result.newGold;
      this.hud.updateGold(this.playerState.gold);

      // Update equipment if it was an equipment purchase
      if (result.newTier !== undefined && result.slot !== undefined) {
        this.playerState.equipment[result.slot] = result.newTier;
        this.playerRenderer.setEquipment(this.playerState.equipment);
      }

      // Update inventory capacity if it was an inventory upgrade
      if (result.newSlots !== undefined && result.newLevel !== undefined) {
        this.playerState.maxInventorySlots = result.newSlots;
        this.playerState.inventoryUpgradeLevel = result.newLevel;
        const usedSlots = this.playerState.inventory.filter(slot => slot !== null).length;
        this.hud.updateInventory(usedSlots, this.playerState.maxInventorySlots);
      }
    });

    this.checkpointPanel = new CheckpointPanel(this.app, (depth) => {
      // Handle descent to selected depth
      if (this.onDescendToDepth) {
        this.onDescendToDepth(depth);
      }
    });

    // Build scene
    this.renderBackground();
    this.renderSun();
    this.renderClouds();
    this.renderGround();
    this.renderMineEntrance();
    this.renderSellStand();
    this.renderShopStand();
    this.positionPlayer();

    // Wire up stand callbacks
    this.setSellCallback(() => {
      this.sellPanel.open(this.playerState);
    });

    this.setShopCallback(() => {
      this.shopPanel.open(this.playerState);
    });
  }

  /**
   * Initialize the surface scene.
   */
  async init(): Promise<void> {
    console.log('🌅 Initializing Surface Scene...');

    // Update player equipment
    this.playerRenderer.setEquipment(this.playerState.equipment);

    // Update HUD
    this.hud.updateGold(this.playerState.gold);
    this.hud.updateDepth(0); // Surface = depth 0
    const usedSlots = this.playerState.inventory.filter(slot => slot !== null).length;
    this.hud.updateInventory(usedSlots, this.playerState.maxInventorySlots);

    // Hide surface button (already on surface)
    this.hud.setButtonVisibility('surface', false);

    console.log('✅ Surface Scene initialized');
  }

  /**
   * Render sky gradient background.
   */
  private renderBackground(): void {
    this.background.clear();

    // For now, use solid sky blue (gradients work differently in PixiJS v8)
    this.background.rect(0, 0, this.app.screen.width, this.app.screen.height);
    this.background.fill(0x87CEEB); // Sky blue

    this.container.addChild(this.background);
  }

  /**
   * Render sun with glow.
   */
  private renderSun(): void {
    this.sun.clear();

    const sunX = this.app.screen.width - 100;
    const sunY = 80;
    const sunRadius = 40;

    // Glow (larger circle with transparency)
    this.sun.circle(sunX, sunY, sunRadius + 20);
    this.sun.fill({ color: 0xFFFF00, alpha: 0.3 });

    // Sun body
    this.sun.circle(sunX, sunY, sunRadius);
    this.sun.fill(0xFFFF00);

    this.container.addChild(this.sun);
  }

  /**
   * Render animated clouds.
   */
  private renderClouds(): void {
    // Create 4 clouds at different positions
    const cloudCount = 4;

    for (let i = 0; i < cloudCount; i++) {
      const cloud = new Graphics();
      const y = 50 + i * 60;
      const x = (this.app.screen.width / cloudCount) * i;
      const speed = 0.02 + Math.random() * 0.02;

      this.drawCloud(cloud, 0, 0);
      cloud.x = x;
      cloud.y = y;

      this.clouds.push(cloud);
      this.cloudPositions.push({ x, y, speed });
      this.container.addChild(cloud);
    }
  }

  /**
   * Draw a single cloud shape.
   */
  private drawCloud(graphics: Graphics, x: number, y: number): void {
    graphics.clear();

    // Three overlapping ellipses to form a cloud
    graphics.ellipse(x, y, 40, 25);
    graphics.fill({ color: 0xFFFFFF, alpha: 0.8 });

    graphics.ellipse(x - 25, y + 5, 30, 20);
    graphics.fill({ color: 0xFFFFFF, alpha: 0.8 });

    graphics.ellipse(x + 25, y + 5, 35, 22);
    graphics.fill({ color: 0xFFFFFF, alpha: 0.8 });
  }

  /**
   * Render grass ground.
   */
  private renderGround(): void {
    this.ground.clear();

    const groundHeight = this.app.screen.height * 0.3;
    const groundY = this.app.screen.height - groundHeight;

    // Main grass area
    this.ground.rect(0, groundY, this.app.screen.width, groundHeight);
    this.ground.fill(0x4CAF50);

    // Grass detail (small triangular blades)
    for (let x = 0; x < this.app.screen.width; x += 15) {
      const height = 8 + Math.random() * 4;
      this.ground.moveTo(x, groundY);
      this.ground.lineTo(x + 5, groundY - height);
      this.ground.lineTo(x + 10, groundY);
      this.ground.fill({ color: 0x45A049, alpha: 0.7 });
    }

    this.container.addChild(this.ground);
  }

  /**
   * Render mine entrance.
   */
  private renderMineEntrance(): void {
    const centerX = this.app.screen.width / 2;
    const groundY = this.app.screen.height * 0.7;

    // Dark hole
    const hole = new Graphics();
    hole.roundRect(-60, 0, 120, 80, 15);
    hole.fill({ color: 0x000000, alpha: 0.8 });
    this.mineEntrance.addChild(hole);

    // Wooden support beams
    const beamColor = 0x8B4513;

    // Left vertical beam
    const leftBeam = new Graphics();
    leftBeam.rect(-70, -20, 15, 100);
    leftBeam.fill(beamColor);
    this.mineEntrance.addChild(leftBeam);

    // Right vertical beam
    const rightBeam = new Graphics();
    rightBeam.rect(55, -20, 15, 100);
    rightBeam.fill(beamColor);
    this.mineEntrance.addChild(rightBeam);

    // Horizontal top beam
    const topBeam = new Graphics();
    topBeam.rect(-70, -25, 140, 15);
    topBeam.fill(beamColor);
    this.mineEntrance.addChild(topBeam);

    // Hanging lantern
    const lantern = new Graphics();
    lantern.circle(0, -40, 8);
    lantern.fill({ color: 0xFFFF00, alpha: 0.9 });
    this.mineEntrance.addChild(lantern);

    // Sign
    const signStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 20,
      fontWeight: 'bold',
      fill: '#8B4513',
      stroke: { color: '#000000', width: 2 }
    });
    const sign = new Text({ text: 'DEEP MINE', style: signStyle });
    sign.anchor.set(0.5);
    sign.y = -60;
    this.mineEntrance.addChild(sign);

    // Descend button
    const descendButton = this.createButton('⬇ DESCEND', 0x4A90D9);
    descendButton.y = 90;
    descendButton.on('pointerup', () => {
      // Show checkpoint selection panel
      this.checkpointPanel.open(this.playerState.checkpoints);
    });
    this.mineEntrance.addChild(descendButton);

    this.mineEntrance.x = centerX;
    this.mineEntrance.y = groundY - 20;

    this.container.addChild(this.mineEntrance);
  }

  /**
   * Render sell stand.
   */
  private renderSellStand(): void {
    const centerX = this.app.screen.width / 2;
    const groundY = this.app.screen.height * 0.7;

    // Wooden booth
    const booth = new Graphics();
    booth.rect(-50, -80, 100, 80);
    booth.fill(0x8B4513);

    // Roof
    const roof = new Graphics();
    roof.moveTo(-60, -80);
    roof.lineTo(0, -110);
    roof.lineTo(60, -80);
    roof.fill(0x654321);

    this.sellStand.addChild(booth);
    this.sellStand.addChild(roof);

    // Sign
    const signStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: '#FFD700'
    });
    const sign = new Text({ text: '🏪 SELL', style: signStyle });
    sign.anchor.set(0.5);
    sign.y = -50;
    this.sellStand.addChild(sign);

    // Interactive area
    this.sellStand.eventMode = 'static';
    this.sellStand.cursor = 'pointer';

    this.sellStand.on('pointerover', () => {
      booth.alpha = 1.2;
    });

    this.sellStand.on('pointerout', () => {
      booth.alpha = 1.0;
    });

    this.sellStand.on('pointerup', () => {
      if (this.onSellClick) {
        this.onSellClick();
      }
    });

    this.sellStand.x = centerX - 200;
    this.sellStand.y = groundY;

    this.container.addChild(this.sellStand);
  }

  /**
   * Render shop stand.
   */
  private renderShopStand(): void {
    const centerX = this.app.screen.width / 2;
    const groundY = this.app.screen.height * 0.7;

    // Wooden booth
    const booth = new Graphics();
    booth.rect(-50, -80, 100, 80);
    booth.fill(0x8B4513);

    // Roof
    const roof = new Graphics();
    roof.moveTo(-60, -80);
    roof.lineTo(0, -110);
    roof.lineTo(60, -80);
    roof.fill(0x654321);

    this.shopStand.addChild(booth);
    this.shopStand.addChild(roof);

    // Sign
    const signStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: '#4488FF'
    });
    const sign = new Text({ text: '🛒 SHOP', style: signStyle });
    sign.anchor.set(0.5);
    sign.y = -50;
    this.shopStand.addChild(sign);

    // Interactive area
    this.shopStand.eventMode = 'static';
    this.shopStand.cursor = 'pointer';

    this.shopStand.on('pointerover', () => {
      booth.alpha = 1.2;
    });

    this.shopStand.on('pointerout', () => {
      booth.alpha = 1.0;
    });

    this.shopStand.on('pointerup', () => {
      if (this.onShopClick) {
        this.onShopClick();
      }
    });

    this.shopStand.x = centerX + 200;
    this.shopStand.y = groundY;

    this.container.addChild(this.shopStand);
  }

  /**
   * Create a button.
   */
  private createButton(text: string, color: number): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(-60, -15, 120, 30, 8);
    bg.fill(color);
    button.addChild(bg);

    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const label = new Text({ text, style: textStyle });
    label.anchor.set(0.5);
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
   * Position player character.
   */
  private positionPlayer(): void {
    const centerX = this.app.screen.width / 2;
    const groundY = this.app.screen.height * 0.7;

    this.playerRenderer.setPosition(centerX + 100, groundY - 40);
  }

  /**
   * Set callback for descend button.
   */
  setDescendCallback(callback: () => void): void {
    this.onDescendClick = callback;
  }

  /**
   * Set callback for descending to a specific depth.
   */
  setDescendToDepthCallback(callback: (depth: number) => void): void {
    this.onDescendToDepth = callback;
  }

  /**
   * Set callback for sell stand.
   */
  setSellCallback(callback: () => void): void {
    this.onSellClick = callback;
  }

  /**
   * Set callback for shop stand.
   */
  setShopCallback(callback: () => void): void {
    this.onShopClick = callback;
  }

  /**
   * Update the scene (called every frame).
   */
  update(delta: number): void {
    const deltaMs = delta * 16.67;

    // Update player renderer
    this.playerRenderer.update(delta);

    // Update HUD
    this.hud.update(deltaMs);

    // Update panels
    this.sellPanel.update(deltaMs);
    this.shopPanel.update(deltaMs);

    // Animate clouds
    this.cloudTimer += deltaMs;
    this.clouds.forEach((cloud, index) => {
      const pos = this.cloudPositions[index];
      pos.x += pos.speed * deltaMs;

      // Loop clouds
      if (pos.x > this.app.screen.width + 100) {
        pos.x = -100;
      }

      cloud.x = pos.x;
    });

    // Grass sway (subtle)
    this.grassSway += deltaMs * 0.001;
  }

  /**
   * Resize handler.
   */
  resize(width: number, height: number): void {
    this.renderBackground();
    this.renderSun();
    this.renderGround();
    this.hud.resize(width, height);
  }

  /**
   * Clean up the scene.
   */
  destroy(): void {
    this.playerRenderer.destroy();
    this.hud.destroy();
    this.sellPanel.destroy();
    this.shopPanel.destroy();
    this.checkpointPanel.destroy();
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
