import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { PlayerState, EquipmentSlot } from '@shared/types';
import { PlayerRenderer } from '../renderer/PlayerRenderer';
import { HUD } from '../ui/HUD';
import { SellPanel } from '../ui/SellPanel';
import { ShopPanel } from '../ui/ShopPanel';
import { CheckpointPanel } from '../ui/CheckpointPanel';
import { audioManager } from '../../audio/AudioManager';
import type { Connection } from '../../networking/Connection';
import type { MessageHandler } from '../../networking/MessageHandler';

/**
 * SurfaceScene — cinematic overworld with sunset sky, mountains,
 * pine forest, atmospheric particles, and detailed buildings.
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

  // Layers (back to front for parallax)
  private skyLayer: Container;
  private sunMoonLayer: Container;
  private farMountainLayer: Container;
  private nearMountainLayer: Container;
  private treeLayer: Container;
  private groundLayer: Container;
  private buildingsLayer: Container;
  private particleLayer: Container;

  // Animated elements
  private clouds: { gfx: Graphics; x: number; speed: number; y: number }[] = [];
  private birds: { gfx: Graphics; x: number; y: number; speed: number; flapPhase: number }[] = [];
  private particles: { gfx: Graphics; x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
  private sunRays: Graphics;
  private sunGlow: Graphics;

  // Scene state
  private time = 0;

  // Callbacks
  private onDescendClick: (() => void) | null = null;
  private onDescendToDepth: ((depth: number) => void) | null = null;
  private onSellClick: (() => void) | null = null;
  private onShopClick: (() => void) | null = null;

  // Multiplayer
  private connection: Connection | null = null;
  private messageHandler: MessageHandler | null = null;
  private surfacePlayers: Map<string, { container: Container; nameText: Text }> = new Map();

  constructor(app: Application, playerState: PlayerState, connection?: Connection, messageHandler?: MessageHandler) {
    this.app = app;
    this.playerState = playerState;
    this.connection = connection ?? null;
    this.messageHandler = messageHandler ?? null;

    this.container = new Container();
    this.app.stage.addChild(this.container);

    // Create layers
    this.skyLayer = new Container();
    this.sunMoonLayer = new Container();
    this.farMountainLayer = new Container();
    this.nearMountainLayer = new Container();
    this.treeLayer = new Container();
    this.groundLayer = new Container();
    this.buildingsLayer = new Container();
    this.particleLayer = new Container();

    this.container.addChild(this.skyLayer);
    this.container.addChild(this.sunMoonLayer);
    this.container.addChild(this.farMountainLayer);
    this.container.addChild(this.nearMountainLayer);
    this.container.addChild(this.treeLayer);
    this.container.addChild(this.groundLayer);
    this.container.addChild(this.buildingsLayer);
    this.container.addChild(this.particleLayer);

    // Temp placeholders for sun elements
    this.sunRays = new Graphics();
    this.sunGlow = new Graphics();

    // Build scene
    this.renderSky();
    this.renderSunWithRays();
    this.renderClouds();
    this.renderFarMountains();
    this.renderNearMountains();
    this.renderPineForest();
    this.renderGround();
    this.renderStream();
    this.renderMineEntrance();
    this.renderSellBuilding();
    this.renderShopBuilding();
    this.renderBirds();

    // Player
    this.playerRenderer = new PlayerRenderer(this.container);
    this.positionPlayer();

    // HUD
    this.hud = new HUD(this.app);

    // Panels
    this.sellPanel = new SellPanel(this.app, (result) => {
      this.playerState.gold = result.newGold;
      this.hud.updateGold(this.playerState.gold);
      const usedSlots = this.playerState.inventory.filter(slot => slot !== null).length;
      this.hud.updateInventory(usedSlots, this.playerState.maxInventorySlots);
    });

    this.shopPanel = new ShopPanel(this.app, (result) => {
      this.playerState.gold = result.newGold;
      this.hud.updateGold(this.playerState.gold);
      if (result.newTier !== undefined && result.slot !== undefined) {
        this.playerState.equipment[result.slot as EquipmentSlot] = result.newTier;
        this.playerRenderer.setEquipment(this.playerState.equipment);
      }
      if (result.newSlots !== undefined && result.newLevel !== undefined) {
        this.playerState.maxInventorySlots = result.newSlots;
        this.playerState.inventoryUpgradeLevel = result.newLevel;
        const usedSlots = this.playerState.inventory.filter(slot => slot !== null).length;
        this.hud.updateInventory(usedSlots, this.playerState.maxInventorySlots);
      }
    });

    this.checkpointPanel = new CheckpointPanel(this.app, (depth) => {
      if (this.onDescendToDepth) this.onDescendToDepth(depth);
    });

    // Wire callbacks
    this.setSellCallback(() => this.sellPanel.open(this.playerState));
    this.setShopCallback(() => this.shopPanel.open(this.playerState));
  }

  async init(): Promise<void> {
    console.log('🌅 Initializing Cinematic Surface Scene...');
    audioManager.playSFX('surface_arrive', 0.5);
    audioManager.playMusic('surface');

    this.playerRenderer.setEquipment(this.playerState.equipment);
    this.hud.updateGold(this.playerState.gold);
    this.hud.updateLives(this.playerState.lives);
    this.hud.updatePosition(this.playerState.position.x, 0);
    const usedSlots = this.playerState.inventory.filter(slot => slot !== null).length;
    this.hud.updateInventory(usedSlots, this.playerState.maxInventorySlots);
    this.hud.setButtonVisibility('surface', false);

    this.setupSurfaceMultiplayer();

    if (this.connection) {
      this.connection.send({ type: 'move', seq: 0, x: this.playerState.position.x, y: 0 });
    }
  }

  // ─── SKY ─────────────────────────────────────────────────────────

  private renderSky(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const sky = new Graphics();

    // Layered sky gradient: dark blue top → orange/pink horizon
    const bands = [
      { y: 0, h: h * 0.15, color: 0x0B1026 },    // Deep night blue
      { y: h * 0.15, h: h * 0.15, color: 0x1A2744 }, // Dark navy
      { y: h * 0.30, h: h * 0.12, color: 0x2D4A7A }, // Steel blue
      { y: h * 0.42, h: h * 0.10, color: 0x4A6FA5 }, // Dusk blue
      { y: h * 0.52, h: h * 0.08, color: 0x8B6A9E }, // Purple haze
      { y: h * 0.60, h: h * 0.06, color: 0xCC7B5C }, // Warm sunset
      { y: h * 0.66, h: h * 0.04, color: 0xE8945A }, // Orange glow
      { y: h * 0.70, h: h * 0.30, color: 0xF0A848 }, // Golden horizon
    ];

    for (const band of bands) {
      sky.rect(0, band.y, w, band.h);
      sky.fill(band.color);
    }

    // Stars in the upper sky
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.45;
      const size = 0.5 + Math.random() * 1.5;
      const alpha = 0.3 + Math.random() * 0.7;
      sky.circle(sx, sy, size);
      sky.fill({ color: 0xFFFFFF, alpha });
    }

    this.skyLayer.addChild(sky);
  }

  private renderSunWithRays(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const sunX = w * 0.75;
    const sunY = h * 0.58;

    // Sun rays (volumetric light)
    this.sunRays.clear();
    const rayCount = 12;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const innerR = 50;
      const outerR = 200 + Math.random() * 100;
      const spread = 0.08;

      this.sunRays.moveTo(
        sunX + Math.cos(angle - spread) * innerR,
        sunY + Math.sin(angle - spread) * innerR
      );
      this.sunRays.lineTo(
        sunX + Math.cos(angle) * outerR,
        sunY + Math.sin(angle) * outerR
      );
      this.sunRays.lineTo(
        sunX + Math.cos(angle + spread) * innerR,
        sunY + Math.sin(angle + spread) * innerR
      );
      this.sunRays.fill({ color: 0xFFDD88, alpha: 0.06 });
    }
    this.sunMoonLayer.addChild(this.sunRays);

    // Outer glow
    this.sunGlow.clear();
    this.sunGlow.circle(sunX, sunY, 80);
    this.sunGlow.fill({ color: 0xFFCC44, alpha: 0.15 });
    this.sunGlow.circle(sunX, sunY, 55);
    this.sunGlow.fill({ color: 0xFFDD66, alpha: 0.25 });
    this.sunMoonLayer.addChild(this.sunGlow);

    // Sun disc
    const sun = new Graphics();
    sun.circle(sunX, sunY, 35);
    sun.fill(0xFFDD44);
    sun.circle(sunX - 5, sunY - 5, 30);
    sun.fill({ color: 0xFFEE88, alpha: 0.5 });
    this.sunMoonLayer.addChild(sun);
  }

  private renderClouds(): void {
    const w = this.app.screen.width;
    for (let i = 0; i < 6; i++) {
      const cloud = new Graphics();
      const cx = Math.random() * w;
      const cy = 40 + Math.random() * 120;
      const scale = 0.6 + Math.random() * 0.8;
      const speed = 0.01 + Math.random() * 0.02;

      // Multi-layered cloud with warm tint from sunset
      const baseColor = i < 3 ? 0xEEDDCC : 0xDDCCBB;
      cloud.ellipse(0, 0, 60 * scale, 20 * scale);
      cloud.fill({ color: baseColor, alpha: 0.7 });
      cloud.ellipse(-30 * scale, 5 * scale, 40 * scale, 16 * scale);
      cloud.fill({ color: baseColor, alpha: 0.6 });
      cloud.ellipse(30 * scale, 5 * scale, 50 * scale, 18 * scale);
      cloud.fill({ color: baseColor, alpha: 0.6 });
      // Highlight top
      cloud.ellipse(0, -5 * scale, 45 * scale, 12 * scale);
      cloud.fill({ color: 0xFFEEDD, alpha: 0.4 });

      cloud.x = cx;
      cloud.y = cy;
      this.skyLayer.addChild(cloud);
      this.clouds.push({ gfx: cloud, x: cx, speed, y: cy });
    }
  }

  // ─── MOUNTAINS ───────────────────────────────────────────────────

  private renderFarMountains(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const baseY = h * 0.65;
    const mtns = new Graphics();

    // Far mountains — blue/purple silhouettes
    const peaks = [
      { x: w * 0.05, y: baseY - 120 },
      { x: w * 0.15, y: baseY - 180 },
      { x: w * 0.28, y: baseY - 140 },
      { x: w * 0.42, y: baseY - 200 },
      { x: w * 0.55, y: baseY - 160 },
      { x: w * 0.68, y: baseY - 190 },
      { x: w * 0.82, y: baseY - 150 },
      { x: w * 0.95, y: baseY - 170 },
    ];

    // Draw mountain range
    mtns.moveTo(0, baseY);
    for (const peak of peaks) {
      mtns.lineTo(peak.x, peak.y);
    }
    mtns.lineTo(w, baseY);
    mtns.closePath();
    mtns.fill({ color: 0x2A3555, alpha: 0.8 });

    // Snow caps
    for (const peak of peaks) {
      if (peak.y < baseY - 150) {
        mtns.moveTo(peak.x, peak.y);
        mtns.lineTo(peak.x - 15, peak.y + 25);
        mtns.lineTo(peak.x + 15, peak.y + 25);
        mtns.closePath();
        mtns.fill({ color: 0xFFFFFF, alpha: 0.4 });
      }
    }

    this.farMountainLayer.addChild(mtns);
  }

  private renderNearMountains(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const baseY = h * 0.68;
    const mtns = new Graphics();

    const peaks = [
      { x: -20, y: baseY - 60 },
      { x: w * 0.1, y: baseY - 100 },
      { x: w * 0.25, y: baseY - 70 },
      { x: w * 0.35, y: baseY - 120 },
      { x: w * 0.5, y: baseY - 80 },
      { x: w * 0.65, y: baseY - 110 },
      { x: w * 0.8, y: baseY - 90 },
      { x: w * 0.92, y: baseY - 100 },
      { x: w + 20, y: baseY - 60 },
    ];

    mtns.moveTo(0, baseY);
    for (const peak of peaks) {
      mtns.lineTo(peak.x, peak.y);
    }
    mtns.lineTo(w, baseY);
    mtns.closePath();
    mtns.fill({ color: 0x1E2B3D, alpha: 0.9 });

    this.nearMountainLayer.addChild(mtns);
  }

  // ─── FOREST ──────────────────────────────────────────────────────

  private renderPineForest(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const baseY = h * 0.72;

    // Dense pine forest silhouettes
    for (let i = 0; i < 40; i++) {
      const tree = new Graphics();
      const tx = (i / 40) * w + (Math.random() - 0.5) * 30;
      const height = 30 + Math.random() * 50;
      const width = 12 + Math.random() * 8;

      // Tree trunk
      tree.rect(tx - 2, baseY - height * 0.3, 4, height * 0.3);
      tree.fill({ color: 0x1A1A1A, alpha: 0.6 });

      // Pine layers (3 triangles stacked)
      for (let layer = 0; layer < 3; layer++) {
        const layerY = baseY - height * 0.3 - layer * (height * 0.25);
        const layerWidth = width * (1 - layer * 0.2);
        tree.moveTo(tx, layerY - height * 0.3);
        tree.lineTo(tx - layerWidth, layerY);
        tree.lineTo(tx + layerWidth, layerY);
        tree.closePath();
        tree.fill({ color: 0x0D1A0D, alpha: 0.7 + layer * 0.05 });
      }

      this.treeLayer.addChild(tree);
    }
  }

  // ─── GROUND ──────────────────────────────────────────────────────

  private renderGround(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const groundY = h * 0.72;
    const ground = new Graphics();

    // Rich green grass with texture layers
    ground.rect(0, groundY, w, h - groundY);
    ground.fill(0x2D5A1E);

    // Lighter grass top strip
    ground.rect(0, groundY, w, 8);
    ground.fill({ color: 0x4CAF50, alpha: 0.8 });

    // Dirt layer below grass
    ground.rect(0, groundY + 20, w, h - groundY - 20);
    ground.fill({ color: 0x3A2A1A, alpha: 0.3 });

    // Grass blades along top edge
    for (let x = 0; x < w; x += 6) {
      const bladeH = 6 + Math.random() * 8;
      const lean = (Math.random() - 0.5) * 4;
      ground.moveTo(x, groundY);
      ground.lineTo(x + lean, groundY - bladeH);
      ground.lineTo(x + 3, groundY);
      ground.fill({ color: 0x3D8B37, alpha: 0.6 + Math.random() * 0.3 });
    }

    // Scattered flowers
    for (let i = 0; i < 20; i++) {
      const fx = Math.random() * w;
      const fy = groundY + 5 + Math.random() * 15;
      const colors = [0xFF6B6B, 0xFFD93D, 0xC084FC, 0xFF9EAA, 0x6BCB77];
      const color = colors[Math.floor(Math.random() * colors.length)];
      ground.circle(fx, fy, 2 + Math.random() * 2);
      ground.fill({ color, alpha: 0.7 });
    }

    // Small rocks
    for (let i = 0; i < 8; i++) {
      const rx = Math.random() * w;
      const ry = groundY + 10 + Math.random() * 20;
      const rw = 4 + Math.random() * 8;
      const rh = 3 + Math.random() * 4;
      ground.ellipse(rx, ry, rw, rh);
      ground.fill({ color: 0x666666, alpha: 0.5 });
      // Highlight
      ground.ellipse(rx - 1, ry - 1, rw * 0.6, rh * 0.5);
      ground.fill({ color: 0x888888, alpha: 0.3 });
    }

    this.groundLayer.addChild(ground);
  }

  private renderStream(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const streamY = h * 0.82;
    const stream = new Graphics();

    // Winding stream
    stream.moveTo(0, streamY);
    stream.bezierCurveTo(w * 0.2, streamY - 10, w * 0.3, streamY + 15, w * 0.5, streamY + 5);
    stream.bezierCurveTo(w * 0.7, streamY - 5, w * 0.85, streamY + 10, w, streamY);
    stream.lineTo(w, streamY + 12);
    stream.bezierCurveTo(w * 0.85, streamY + 22, w * 0.7, streamY + 7, w * 0.5, streamY + 17);
    stream.bezierCurveTo(w * 0.3, streamY + 27, w * 0.2, streamY + 2, 0, streamY + 12);
    stream.closePath();
    stream.fill({ color: 0x3498DB, alpha: 0.6 });

    // Water shimmer highlights
    for (let i = 0; i < 15; i++) {
      const sx = Math.random() * w;
      const sy = streamY + Math.random() * 10;
      stream.ellipse(sx, sy, 6 + Math.random() * 8, 1.5);
      stream.fill({ color: 0xADD8E6, alpha: 0.4 });
    }

    this.groundLayer.addChild(stream);
  }

  // ─── BUILDINGS ───────────────────────────────────────────────────

  private renderMineEntrance(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = w / 2;
    const groundY = h * 0.72;
    const entrance = new Container();

    // Stone archway
    const arch = new Graphics();
    // Outer stone frame
    arch.roundRect(-70, -10, 140, 95, 5);
    arch.fill(0x555555);
    // Stone texture blocks
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const bx = -68 + col * 28;
        const by = -8 + row * 22;
        arch.rect(bx, by, 26, 20);
        arch.stroke({ color: 0x444444, width: 1 });
        arch.fill({ color: 0x666666 + (row + col) * 0x080808, alpha: 0.3 });
      }
    }
    // Dark mine hole
    arch.roundRect(-55, 5, 110, 80, 8);
    arch.fill({ color: 0x0A0A0A, alpha: 0.95 });
    // Mine hole depth effect
    arch.roundRect(-50, 10, 100, 70, 6);
    arch.fill({ color: 0x050505 });
    entrance.addChild(arch);

    // Wooden support beams
    const beams = new Graphics();
    // Left beam
    beams.rect(-62, -15, 12, 100);
    beams.fill(0x6B4226);
    beams.rect(-62, -15, 3, 100);
    beams.fill({ color: 0x8B5A2B, alpha: 0.4 });
    // Right beam
    beams.rect(50, -15, 12, 100);
    beams.fill(0x6B4226);
    beams.rect(59, -15, 3, 100);
    beams.fill({ color: 0x5A3A1A, alpha: 0.4 });
    // Top beam with wood grain
    beams.rect(-65, -20, 130, 12);
    beams.fill(0x7B4A2B);
    beams.rect(-65, -20, 130, 4);
    beams.fill({ color: 0x8B5A3B, alpha: 0.4 });
    entrance.addChild(beams);

    // Hanging lanterns (2)
    for (const lx of [-35, 35]) {
      const lantern = new Graphics();
      // Chain
      lantern.moveTo(lx, -18);
      lantern.lineTo(lx, -32);
      lantern.stroke({ width: 1.5, color: 0x888888 });
      // Lantern body
      lantern.roundRect(lx - 5, -38, 10, 12, 2);
      lantern.fill(0x8B4513);
      // Lantern glow
      lantern.circle(lx, -32, 8);
      lantern.fill({ color: 0xFFAA00, alpha: 0.4 });
      lantern.circle(lx, -32, 4);
      lantern.fill({ color: 0xFFDD44, alpha: 0.8 });
      entrance.addChild(lantern);
    }

    // Mine sign (wooden board)
    const signBoard = new Graphics();
    signBoard.roundRect(-55, -65, 110, 30, 4);
    signBoard.fill(0x5A3A1A);
    signBoard.roundRect(-55, -65, 110, 30, 4);
    signBoard.stroke({ color: 0x3A2A0A, width: 2 });
    // Nails
    signBoard.circle(-48, -50, 2);
    signBoard.fill(0xCCCCCC);
    signBoard.circle(48, -50, 2);
    signBoard.fill(0xCCCCCC);
    entrance.addChild(signBoard);

    const signStyle = new TextStyle({
      fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 'bold', fill: '#F0C850',
      dropShadow: { color: '#000000', blur: 2, distance: 1, angle: Math.PI / 4 },
    });
    const sign = new Text({ text: 'DEEP MINE', style: signStyle });
    sign.anchor.set(0.5);
    sign.y = -50;
    entrance.addChild(sign);

    // Descend button
    const descendBtn = this.createCinematicButton('DESCEND', 0x4A90D9, 0x6AB0F9);
    descendBtn.y = 100;
    descendBtn.on('pointerup', () => {
      this.checkpointPanel.open(this.playerState.checkpoints);
    });
    entrance.addChild(descendBtn);

    entrance.x = cx;
    entrance.y = groundY - 25;
    this.buildingsLayer.addChild(entrance);
  }

  private renderSellBuilding(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = w / 2 - 220;
    const groundY = h * 0.72;
    const building = new Container();

    // Main structure
    const walls = new Graphics();
    walls.roundRect(-55, -90, 110, 90, 3);
    walls.fill(0x6B4226);
    // Window
    walls.roundRect(-20, -70, 40, 30, 3);
    walls.fill({ color: 0xFFDD88, alpha: 0.6 });
    walls.roundRect(-20, -70, 40, 30, 3);
    walls.stroke({ color: 0x5A3A1A, width: 2 });
    // Cross bars
    walls.rect(-1, -70, 2, 30);
    walls.fill(0x5A3A1A);
    walls.rect(-20, -56, 40, 2);
    walls.fill(0x5A3A1A);
    // Counter
    walls.rect(-60, -5, 120, 10);
    walls.fill(0x8B5A3B);
    walls.rect(-60, -5, 120, 3);
    walls.fill({ color: 0xA06A4B, alpha: 0.5 });
    building.addChild(walls);

    // Roof
    const roof = new Graphics();
    roof.moveTo(-65, -90);
    roof.lineTo(0, -125);
    roof.lineTo(65, -90);
    roof.closePath();
    roof.fill(0x8B0000);
    // Roof highlight
    roof.moveTo(-60, -90);
    roof.lineTo(0, -120);
    roof.lineTo(5, -90);
    roof.closePath();
    roof.fill({ color: 0xAA2222, alpha: 0.3 });
    building.addChild(roof);

    // Hanging sign
    const hangSign = new Graphics();
    hangSign.roundRect(-30, -82, 60, 20, 3);
    hangSign.fill(0x3A2A0A);
    hangSign.roundRect(-30, -82, 60, 20, 3);
    hangSign.stroke({ color: 0x5A3A1A, width: 1 });
    building.addChild(hangSign);

    const signStyle = new TextStyle({
      fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', fill: '#FFD700',
    });
    const sign = new Text({ text: 'SELL', style: signStyle });
    sign.anchor.set(0.5);
    sign.y = -72;
    building.addChild(sign);

    // Gold sacks on counter
    for (const sx of [-25, 0, 20]) {
      const sack = new Graphics();
      sack.ellipse(sx, -12, 8, 10);
      sack.fill(0xC8A852);
      sack.rect(sx - 3, -22, 6, 5);
      sack.fill(0xA08832);
      building.addChild(sack);
    }

    // Interactive
    building.eventMode = 'static';
    building.cursor = 'pointer';
    building.on('pointerover', () => { building.alpha = 0.9; });
    building.on('pointerout', () => { building.alpha = 1; });
    building.on('pointerup', () => { if (this.onSellClick) this.onSellClick(); });

    building.x = cx;
    building.y = groundY;
    this.buildingsLayer.addChild(building);
  }

  private renderShopBuilding(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = w / 2 + 220;
    const groundY = h * 0.72;
    const building = new Container();

    // Main structure
    const walls = new Graphics();
    walls.roundRect(-55, -90, 110, 90, 3);
    walls.fill(0x2A4A6B);
    // Window
    walls.roundRect(-20, -70, 40, 30, 3);
    walls.fill({ color: 0x88BBFF, alpha: 0.6 });
    walls.roundRect(-20, -70, 40, 30, 3);
    walls.stroke({ color: 0x1A3A5B, width: 2 });
    // Cross bars
    walls.rect(-1, -70, 2, 30);
    walls.fill(0x1A3A5B);
    walls.rect(-20, -56, 40, 2);
    walls.fill(0x1A3A5B);
    // Counter
    walls.rect(-60, -5, 120, 10);
    walls.fill(0x4A6A8B);
    walls.rect(-60, -5, 120, 3);
    walls.fill({ color: 0x5A7A9B, alpha: 0.5 });
    building.addChild(walls);

    // Roof
    const roof = new Graphics();
    roof.moveTo(-65, -90);
    roof.lineTo(0, -125);
    roof.lineTo(65, -90);
    roof.closePath();
    roof.fill(0x1A3A6B);
    roof.moveTo(-60, -90);
    roof.lineTo(0, -120);
    roof.lineTo(5, -90);
    roof.closePath();
    roof.fill({ color: 0x2A4A7B, alpha: 0.3 });
    building.addChild(roof);

    // Hanging sign
    const hangSign = new Graphics();
    hangSign.roundRect(-30, -82, 60, 20, 3);
    hangSign.fill(0x0A1A3A);
    hangSign.roundRect(-30, -82, 60, 20, 3);
    hangSign.stroke({ color: 0x1A3A5B, width: 1 });
    building.addChild(hangSign);

    const signStyle = new TextStyle({
      fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', fill: '#88CCFF',
    });
    const sign = new Text({ text: 'SHOP', style: signStyle });
    sign.anchor.set(0.5);
    sign.y = -72;
    building.addChild(sign);

    // Equipment on counter
    const equip = new Graphics();
    // Pickaxe
    equip.moveTo(-20, -15);
    equip.lineTo(-5, -25);
    equip.stroke({ width: 3, color: 0x8B5A2B });
    equip.circle(-5, -25, 3);
    equip.fill(0xCCCCCC);
    // Helmet
    equip.arc(15, -18, 10, Math.PI, 0);
    equip.fill(0xFFD700);
    building.addChild(equip);

    // Interactive
    building.eventMode = 'static';
    building.cursor = 'pointer';
    building.on('pointerover', () => { building.alpha = 0.9; });
    building.on('pointerout', () => { building.alpha = 1; });
    building.on('pointerup', () => { if (this.onShopClick) this.onShopClick(); });

    building.x = cx;
    building.y = groundY;
    this.buildingsLayer.addChild(building);
  }

  // ─── BIRDS ───────────────────────────────────────────────────────

  private renderBirds(): void {
    const w = this.app.screen.width;
    for (let i = 0; i < 4; i++) {
      const bird = new Graphics();
      const bx = Math.random() * w;
      const by = 30 + Math.random() * 100;
      const speed = 0.3 + Math.random() * 0.5;

      this.drawBird(bird, 0);
      bird.x = bx;
      bird.y = by;
      this.skyLayer.addChild(bird);
      this.birds.push({ gfx: bird, x: bx, y: by, speed, flapPhase: Math.random() * Math.PI * 2 });
    }
  }

  private drawBird(gfx: Graphics, flapAngle: number): void {
    gfx.clear();
    const wingY = Math.sin(flapAngle) * 4;
    // Left wing
    gfx.moveTo(0, 0);
    gfx.lineTo(-8, wingY - 3);
    gfx.lineTo(-5, wingY);
    gfx.stroke({ width: 1.5, color: 0x111111 });
    // Right wing
    gfx.moveTo(0, 0);
    gfx.lineTo(8, wingY - 3);
    gfx.lineTo(5, wingY);
    gfx.stroke({ width: 1.5, color: 0x111111 });
  }

  // ─── BUTTONS ─────────────────────────────────────────────────────

  private createCinematicButton(text: string, color: number, highlight: number): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(-70, -18, 140, 36, 8);
    bg.fill(color);
    bg.roundRect(-70, -18, 140, 36, 8);
    bg.stroke({ width: 2, color: highlight, alpha: 0.5 });
    // Inner highlight
    bg.roundRect(-68, -16, 136, 16, 6);
    bg.fill({ color: highlight, alpha: 0.15 });
    button.addChild(bg);

    const style = new TextStyle({
      fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 'bold', fill: '#FFFFFF',
      dropShadow: { color: '#000000', blur: 3, distance: 1, angle: Math.PI / 4 },
    });
    const label = new Text({ text, style });
    label.anchor.set(0.5);
    button.addChild(label);

    button.on('pointerover', () => { button.scale.set(1.05); });
    button.on('pointerout', () => { button.scale.set(1.0); });
    button.on('pointerdown', () => { button.scale.set(0.95); });

    return button;
  }

  // ─── PLAYER ──────────────────────────────────────────────────────

  private positionPlayer(): void {
    const cx = this.app.screen.width / 2;
    const groundY = this.app.screen.height * 0.72;
    this.playerRenderer.setPosition(cx + 110, groundY - 40);
  }

  // ─── MULTIPLAYER ─────────────────────────────────────────────────

  private setupSurfaceMultiplayer(): void {
    if (!this.messageHandler) return;

    this.messageHandler.on('player_info_update', (msg) => {
      if (msg.playerId === this.playerState.id) return;
      if (msg.y <= 1) {
        this.addOrUpdateSurfacePlayer(msg.playerId, msg.displayName);
      } else {
        this.removeSurfacePlayer(msg.playerId);
      }
    });

    this.messageHandler.on('other_player_left', (msg) => {
      this.removeSurfacePlayer(msg.playerId);
    });
  }

  private addOrUpdateSurfacePlayer(playerId: string, displayName: string): void {
    if (this.surfacePlayers.has(playerId)) return;

    const groundY = this.app.screen.height * 0.72;
    const existingCount = this.surfacePlayers.size;
    const xOffset = ((existingCount % 6) - 2.5) * 60;
    const px = this.app.screen.width / 2 + xOffset;

    const playerContainer = new Container();
    playerContainer.x = px;
    playerContainer.y = groundY - 40;

    // Draw miner
    const body = new Graphics();
    const bw = 30, bh = 36;
    body.rect(bw * 0.2, bh * 0.3, bw * 0.6, bh * 0.5);
    body.fill(0x2288DD);
    body.circle(bw * 0.5, bh * 0.2, bw * 0.2);
    body.fill(0xFFCC88);
    body.rect(bw * 0.25, bh * 0.05, bw * 0.5, bh * 0.15);
    body.fill(0xFFDD44);
    body.rect(bw * 0.25, bh * 0.8, bw * 0.2, bh * 0.18);
    body.fill(0x443322);
    body.rect(bw * 0.55, bh * 0.8, bw * 0.2, bh * 0.18);
    body.fill(0x443322);
    playerContainer.addChild(body);

    const nameStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif', fontSize: 11, fill: '#FFFFFF',
      dropShadow: { color: '#000000', blur: 2, angle: Math.PI / 4, distance: 1 },
    });
    const nameText = new Text({ text: displayName, style: nameStyle });
    nameText.anchor.set(0.5, 1);
    nameText.x = bw / 2;
    nameText.y = -4;
    playerContainer.addChild(nameText);

    this.container.addChild(playerContainer);
    this.surfacePlayers.set(playerId, { container: playerContainer, nameText });
  }

  private removeSurfacePlayer(playerId: string): void {
    const entry = this.surfacePlayers.get(playerId);
    if (!entry) return;
    this.container.removeChild(entry.container);
    entry.container.destroy({ children: true });
    this.surfacePlayers.delete(playerId);
  }

  // ─── CALLBACKS ───────────────────────────────────────────────────

  setDescendCallback(callback: () => void): void { this.onDescendClick = callback; }
  setDescendToDepthCallback(callback: (depth: number) => void): void { this.onDescendToDepth = callback; }
  setSellCallback(callback: () => void): void { this.onSellClick = callback; }
  setShopCallback(callback: () => void): void { this.onShopClick = callback; }

  // ─── UPDATE ──────────────────────────────────────────────────────

  update(delta: number): void {
    const deltaMs = delta * 16.67;
    this.time += deltaMs;

    // Player + HUD
    this.playerRenderer.update(delta);
    this.hud.update(deltaMs);
    this.sellPanel.update(deltaMs);
    this.shopPanel.update(deltaMs);

    // Animate clouds
    const w = this.app.screen.width;
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * deltaMs;
      if (cloud.x > w + 150) cloud.x = -150;
      cloud.gfx.x = cloud.x;
    }

    // Animate birds
    for (const bird of this.birds) {
      bird.x += bird.speed * deltaMs * 0.05;
      bird.flapPhase += deltaMs * 0.008;
      bird.y += Math.sin(this.time * 0.002 + bird.flapPhase) * 0.15;
      if (bird.x > w + 50) { bird.x = -50; bird.y = 30 + Math.random() * 100; }
      bird.gfx.x = bird.x;
      bird.gfx.y = bird.y;
      this.drawBird(bird.gfx, bird.flapPhase);
    }

    // Sun glow pulse
    const glowPulse = 1 + 0.05 * Math.sin(this.time * 0.001);
    this.sunGlow.scale.set(glowPulse);

    // Sun rays slow rotation
    this.sunRays.rotation = Math.sin(this.time * 0.0002) * 0.05;

    // Spawn atmospheric particles (dust motes / fireflies)
    if (Math.random() < 0.03) {
      const particle = new Graphics();
      const px = Math.random() * w;
      const py = this.app.screen.height * 0.5 + Math.random() * this.app.screen.height * 0.3;
      const size = 1 + Math.random() * 2;
      particle.circle(0, 0, size);
      particle.fill({ color: 0xFFDD88, alpha: 0.3 + Math.random() * 0.4 });
      particle.x = px;
      particle.y = py;
      this.particleLayer.addChild(particle);
      this.particles.push({
        gfx: particle, x: px, y: py,
        vx: (Math.random() - 0.5) * 0.02,
        vy: -0.01 - Math.random() * 0.02,
        life: 0, maxLife: 3000 + Math.random() * 3000,
      });
    }

    // Update particles
    const toRemove: number[] = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life += deltaMs;
      p.x += p.vx * deltaMs;
      p.y += p.vy * deltaMs;
      p.gfx.x = p.x;
      p.gfx.y = p.y;
      const lifeRatio = p.life / p.maxLife;
      p.gfx.alpha = lifeRatio < 0.2
        ? lifeRatio / 0.2
        : lifeRatio > 0.8
          ? (1 - lifeRatio) / 0.2
          : 1;
      p.gfx.alpha *= 0.5;
      if (p.life >= p.maxLife) toRemove.push(i);
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      this.particleLayer.removeChild(this.particles[idx].gfx);
      this.particles[idx].gfx.destroy();
      this.particles.splice(idx, 1);
    }
  }

  // ─── CLEANUP ─────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    this.hud.resize(width, height);
  }

  destroy(): void {
    for (const [id] of this.surfacePlayers) {
      this.removeSurfacePlayer(id);
    }
    this.surfacePlayers.clear();
    for (const p of this.particles) {
      p.gfx.destroy();
    }
    this.particles = [];
    this.playerRenderer.destroy();
    this.hud.destroy();
    this.sellPanel.destroy();
    this.shopPanel.destroy();
    this.checkpointPanel.destroy();
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
