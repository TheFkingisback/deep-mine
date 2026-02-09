import { Application, Container, Text, TextStyle, FederatedPointerEvent, Graphics } from 'pixi.js';
import { BlockRenderer } from '../renderer/BlockRenderer';
import { PlayerRenderer } from '../renderer/PlayerRenderer';
import { ItemDropRenderer } from '../renderer/ItemDropRenderer';
import { LightingSystem } from '../systems/LightingSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { HUD } from '../ui/HUD';
import { InventoryPanel } from '../ui/InventoryPanel';
import { CheckpointReplacePanel } from '../ui/CheckpointReplacePanel';
import { ExplosionEffect } from '../effects/ExplosionEffect';
import { EventEffects } from '../effects/EventEffects';
import { ParticleSystem } from '../effects/ParticleSystem';
import { PlayerState, ChunkData, DropItem, Position, Block, BlockType } from '@shared/types';
import { generateChunk } from '@shared/world-gen';
import { getShovelDamage, getMaxDepth, getTorchRadius, getRopeSpeed, getMaxCheckpoints } from '@shared/equipment';
import { rollLootDrop, getLayerAtDepth } from '@shared/layers';
import { createRNG } from '@shared/world-gen';
import { rollEvent, applyEvent } from '@shared/events';
import { calculateFullExplosion } from '@shared/tnt';
import { addItem } from '@shared/inventory';
import { STUN_DURATION, TNT_CHAIN_DELAY, BLOCK_SIZE } from '@shared/constants';

/**
 * MiningScene is the main gameplay scene.
 * Manages blocks, player, digging, chunk loading, and camera.
 */
export class MiningScene {
  private app: Application;
  private container: Container;

  // Renderers
  private blockRenderer: BlockRenderer;
  private playerRenderer: PlayerRenderer;
  private itemDropRenderer: ItemDropRenderer;
  private lightingSystem: LightingSystem;
  private cameraSystem: CameraSystem;
  private particleSystem: ParticleSystem;
  private hud: HUD;
  private inventoryPanel: InventoryPanel;
  private checkpointReplacePanel: CheckpointReplacePanel;

  // Background
  private bgGraphics: Graphics;

  // Game state
  private playerState: PlayerState;
  private loadedChunks: Map<number, ChunkData> = new Map();
  private worldSeed: number;
  private activeDrops: Map<string, DropItem> = new Map();
  private worldBlocks: Map<string, Block> = new Map();

  // Input
  private clickHandler: (e: FederatedPointerEvent) => void;
  private keyHandler!: (e: KeyboardEvent) => void;

  // RNG
  private rng: () => number;

  // Player launch animation
  private isLaunching = false;
  private launchStartY = 0;
  private launchTargetY = 0;
  private launchProgress = 0;
  private launchDuration = 400; // ms

  // Rock slide state
  private rockSlideActive = false;
  private rockSlideBlocksRemaining = 0;
  private rockSlideHardnessBonus = 0;

  // Ascent animation
  private isAscending = false;

  // Callbacks
  private onSurfaceCallback: (() => void) | null = null;

  constructor(app: Application, playerState: PlayerState) {
    this.app = app;
    this.playerState = playerState;
    this.worldSeed = Math.floor(Math.random() * 1000000);
    this.rng = createRNG(this.worldSeed + Date.now());

    // Create container
    this.container = new Container();
    this.app.stage.addChild(this.container);

    // Create background gradient (behind blocks)
    this.bgGraphics = new Graphics();
    this.container.addChild(this.bgGraphics);

    // Create renderers and systems
    this.blockRenderer = new BlockRenderer(this.container);
    this.particleSystem = new ParticleSystem(this.container);
    this.playerRenderer = new PlayerRenderer(this.app.stage); // Player in separate layer
    this.itemDropRenderer = new ItemDropRenderer(this.container);
    this.lightingSystem = new LightingSystem(this.app);
    this.cameraSystem = new CameraSystem(this.app.screen.width, this.app.screen.height);
    this.hud = new HUD(this.app);
    this.inventoryPanel = new InventoryPanel(this.app);
    this.checkpointReplacePanel = new CheckpointReplacePanel(this.app, (oldDepth, newDepth) => {
      // Remove old checkpoint and add new one
      const index = this.playerState.checkpoints.indexOf(oldDepth);
      if (index !== -1) {
        this.playerState.checkpoints[index] = newDepth;
        this.showCheckpointSavedFeedback(newDepth);
        this.updateHUDCheckpoints();
      }
    });

    // Set up HUD callbacks
    this.hud.setButtonCallback('surface', () => this.handleSurfaceClick());
    this.hud.setButtonCallback('checkpoint', () => this.handleCheckpointClick());

    // Set up input
    this.clickHandler = this.handleClick.bind(this);
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', this.clickHandler);

    // Set up keyboard controls
    this.setupKeyboardControls();
  }

  /**
   * Dig or move in a specific direction based on arrow keys.
   */
  private digInDirection(dx: number, dy: number): void {
    // Check if player is stunned or ascending
    if (this.playerState.isStunned || this.isAscending) {
      return;
    }

    const targetX = this.playerState.position.x + dx;
    const targetY = this.playerState.position.y + dy;

    // Get the block at target position
    const blockKey = `${targetX},${targetY}`;
    const block = this.worldBlocks.get(blockKey);

    // If empty space, move player there
    if (!block || block.type === BlockType.EMPTY) {
      console.log(`Moving player from (${this.playerState.position.x}, ${this.playerState.position.y}) to (${targetX}, ${targetY})`);
      this.playerState.position.x = targetX;
      this.playerState.position.y = targetY;
      this.applyGravity();
      this.renderWorld();
      return;
    }

    // If there's a block, dig it
    // Check depth limit
    const maxDepth = getMaxDepth(this.playerState.equipment.helmet);
    if (targetY > maxDepth) {
      console.log(`Too deep! (depth: ${targetY}, max: ${maxDepth})`);
      return;
    }

    // Calculate damage
    let damage = getShovelDamage(this.playerState.equipment.shovel);

    // Apply rock slide penalty
    if (this.rockSlideActive) {
      damage = Math.max(1, damage - this.rockSlideHardnessBonus);
    }

    // Apply damage to block
    block.hp = Math.max(0, block.hp - damage);

    // Play dig animation
    this.playerRenderer.playDigAnimation();

    console.log(`Digging block at (${targetX}, ${targetY}): HP ${block.hp}/${block.maxHp}`);

    // Check if block is destroyed
    if (block.hp <= 0) {
      this.destroyBlock(targetX, targetY, block);

      // Decrement rock slide counter
      if (this.rockSlideActive) {
        this.rockSlideBlocksRemaining--;
        if (this.rockSlideBlocksRemaining <= 0) {
          this.rockSlideActive = false;
          this.rockSlideHardnessBonus = 0;
          console.log('Rock slide effect ended');
          this.hud.showFloatingText('Rock slide ended!', this.app.screen.width / 2, this.app.screen.height / 2, '#00FF00');
        }
      }
    }

    // Re-render world
    this.renderWorld();
  }

  /**
   * Set up keyboard controls for player movement and digging.
   */
  private setupKeyboardControls(): void {
    this.keyHandler = (event: KeyboardEvent) => {
      // Ignore key repeat - one action per key press only
      if (event.repeat) return;

      // Ignore if player is stunned or ascending
      if (this.playerState.isStunned || this.isAscending) {
        return;
      }

      // Ignore if typing in input field
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const key = event.key.toLowerCase();

      // Arrow keys or WASD - dig or move in direction
      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault();
        this.digInDirection(-1, 0); // Left
      } else if (key === 'arrowright' || key === 'd') {
        event.preventDefault();
        this.digInDirection(1, 0); // Right
      } else if (key === 'arrowdown' || key === 's') {
        event.preventDefault();
        this.digInDirection(0, 1); // Down
      } else if (key === 'arrowup' || key === 'w') {
        event.preventDefault();
        this.digInDirection(0, -1); // Up
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }


  /**
   * Initialize the mining scene.
   */
  async init(): Promise<void> {
    console.log('⛏️ Initializing Mining Scene...');
    console.log(`World Seed: ${this.worldSeed}`);

    // Load initial chunks around player
    this.loadChunksAroundPlayer();
    console.log(`📦 Loaded ${this.loadedChunks.size} chunks, ${this.worldBlocks.size} total blocks`);

    // Set player equipment
    this.playerRenderer.setEquipment(this.playerState.equipment);
    console.log(`🎒 Player equipment set:`, this.playerState.equipment);

    // Set initial torch radius
    const torchRadius = getTorchRadius(this.playerState.equipment.torch);
    this.lightingSystem.setTorchRadius(torchRadius);

    // Player spawns at the position set in Game.ts (center of map, surface)
    console.log(`🎯 Player spawning at (${this.playerState.position.x}, ${this.playerState.position.y})`);

    // Initialize camera at player position (no lerp on first frame)
    const playerWorldX = this.playerState.position.x * 40;
    const playerWorldY = this.playerState.position.y * 40;
    this.cameraSystem.setPosition(playerWorldX, playerWorldY);

    // Initialize HUD
    this.hud.updateGold(this.playerState.gold);
    this.hud.updateDepth(this.playerState.position.y);
    this.hud.updateItems(this.playerState.inventory);
    this.updateHUDCheckpoints();

    // Initial render
    this.renderWorld();

    console.log('✅ Mining Scene initialized');
  }

  /**
   * Handle click/tap input for digging.
   */
  private handleClick(event: FederatedPointerEvent): void {
    console.log(`\n🖱️ CLICK at screen (${event.global.x.toFixed(0)}, ${event.global.y.toFixed(0)})`);

    // Check if player is stunned or ascending
    if (this.playerState.isStunned) {
      console.log('❌ Cannot dig while stunned!');
      return;
    }

    if (this.isAscending) {
      console.log('❌ Cannot dig while ascending!');
      return;
    }

    // Convert screen coordinates to block coordinates
    const screenX = event.global.x;
    const screenY = event.global.y;

    // Use camera system for coordinate conversion
    const blockPos = this.cameraSystem.screenToBlock(screenX, screenY);
    const worldX = blockPos.x;
    const worldY = blockPos.y;

    console.log(`  Player at block (${this.playerState.position.x}, ${this.playerState.position.y})`);
    console.log(`  Clicked block (${worldX}, ${worldY})`);

    // Check if block is adjacent to player (below, left, or right)
    const dx = Math.abs(worldX - this.playerState.position.x);
    const dy = worldY - this.playerState.position.y;

    console.log(`  Distance: dx=${dx}, dy=${dy}`);

    const isAdjacent = (
      (dx === 0 && dy === 1) || // Below
      (dx === 1 && dy === 0) || // Left or right
      (dx === 0 && dy === 0)    // Same position
    );

    if (!isAdjacent) {
      console.log(`❌ Block not adjacent to player`);
      return;
    }

    console.log(`✅ Block is adjacent, digging...`);

    // Check depth limit (helmet restriction)
    const maxDepth = getMaxDepth(this.playerState.equipment.helmet);
    if (worldY > maxDepth) {
      this.showFloatingText(screenX, screenY, 'Too deep!', 0xFF0000);
      console.log(`Block too deep (depth: ${worldY}, max: ${maxDepth})`);
      return;
    }

    // Get the block
    const blockKey = `${worldX},${worldY}`;
    const block = this.worldBlocks.get(blockKey);

    if (!block || block.type === BlockType.EMPTY) {
      console.log('No block to dig');
      return;
    }

    // Calculate damage
    let damage = getShovelDamage(this.playerState.equipment.shovel);

    // Apply rock slide penalty (reduces damage dealt)
    if (this.rockSlideActive) {
      damage = Math.max(1, damage - this.rockSlideHardnessBonus);
      console.log(`Rock slide active: damage reduced from ${damage + this.rockSlideHardnessBonus} to ${damage}`);
    }

    // Apply damage to block
    block.hp = Math.max(0, block.hp - damage);

    // Play dig animation
    this.playerRenderer.playDigAnimation();

    // Show damage number (orange if rock slide active)
    const damageColor = this.rockSlideActive ? 0xFFAA00 : 0xFFFFFF;
    this.showFloatingText(screenX, screenY, `-${damage}`, damageColor);

    console.log(`Block HP: ${block.hp}/${block.maxHp}`);

    // Check if block is destroyed
    if (block.hp <= 0) {
      this.destroyBlock(worldX, worldY, block);

      // Decrement rock slide counter
      if (this.rockSlideActive) {
        this.rockSlideBlocksRemaining--;
        if (this.rockSlideBlocksRemaining <= 0) {
          this.rockSlideActive = false;
          this.rockSlideHardnessBonus = 0;
          console.log('Rock slide effect ended');
          this.hud.showFloatingText('Rock slide ended!', this.app.screen.width / 2, this.app.screen.height / 2, '#00FF00');
        }
      }
    }

    // Re-render world
    this.renderWorld();
  }

  /**
   * Handle Surface button click.
   * If underground: ascend to surface (y=1)
   * If at surface: go to surface area (buy/sell)
   */
  private handleSurfaceClick(): void {
    if (this.playerState.position.y <= 1) {
      // Already at surface - go to buy/sell
      console.log('🏔️ Going to surface area...');
      if (this.onSurfaceCallback) {
        this.onSurfaceCallback();
      }
    } else {
      // Underground - ascend to surface with animation
      console.log('⬆️ Ascending to surface...');
      this.startAscent();
    }
  }

  /**
   * Handle Inventory button click.
   */
  private handleInventoryClick(): void {
    console.log('Inventory button clicked');
    this.inventoryPanel.toggle(this.playerState.inventory, this.playerState.maxInventorySlots);
  }

  /**
   * Handle Checkpoint button click.
   */
  private handleCheckpointClick(): void {
    const currentDepth = Math.floor(this.playerState.position.y);
    const ropeTier = this.playerState.equipment.rope;
    const maxCheckpoints = getMaxCheckpoints(ropeTier);

    // Check if rope tier allows checkpoints
    if (maxCheckpoints === 0) {
      // Show warning message
      const screenX = this.app.screen.width / 2;
      const screenY = this.app.screen.height / 2;
      this.hud.showFloatingText('Need Strong Rope (Tier 3+)!', screenX, screenY, '#FFEB3B');
      return;
    }

    // Check if checkpoints are full
    if (this.playerState.checkpoints.length >= maxCheckpoints) {
      // Show replace panel
      this.checkpointReplacePanel.open(this.playerState.checkpoints, currentDepth);
      return;
    }

    // Save checkpoint
    this.playerState.checkpoints.push(currentDepth);
    this.showCheckpointSavedFeedback(currentDepth);
    this.updateHUDCheckpoints();
  }

  /**
   * Show visual feedback when checkpoint is saved.
   */
  private showCheckpointSavedFeedback(depth: number): void {
    // Floating text
    const screenX = this.app.screen.width / 2;
    const screenY = this.app.screen.height / 2;
    this.hud.showFloatingText(`📍 Checkpoint saved at Depth ${depth}!`, screenX, screenY, '#00FF00');

    // Green flash + checkmark animation at player position
    const playerScreenPos = this.cameraSystem.worldToScreen(
      this.playerState.position.x * BLOCK_SIZE,
      this.playerState.position.y * BLOCK_SIZE
    );

    // Create green flash
    const flash = new Graphics();
    flash.circle(0, 0, BLOCK_SIZE * 2);
    flash.fill({ color: 0x00FF00, alpha: 0.5 });
    flash.x = playerScreenPos.x;
    flash.y = playerScreenPos.y;
    this.container.addChild(flash);

    // Animate flash
    let flashAlpha = 0.5;
    const flashInterval = setInterval(() => {
      flashAlpha -= 0.05;
      flash.alpha = flashAlpha;
      if (flashAlpha <= 0) {
        clearInterval(flashInterval);
        this.container.removeChild(flash);
        flash.destroy();
      }
    }, 16);

    // Create checkmark
    const checkStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 48,
      fontWeight: 'bold',
      fill: '#00FF00',
      dropShadow: {
        color: '#000000',
        blur: 4,
        angle: Math.PI / 4,
        distance: 3
      }
    });
    const checkmark = new Text({ text: '✓', style: checkStyle });
    checkmark.anchor.set(0.5);
    checkmark.x = playerScreenPos.x;
    checkmark.y = playerScreenPos.y - BLOCK_SIZE;
    this.container.addChild(checkmark);

    // Animate checkmark (rise and fade)
    let checkY = playerScreenPos.y - BLOCK_SIZE;
    let checkAlpha = 1.0;
    const checkInterval = setInterval(() => {
      checkY -= 2;
      checkAlpha -= 0.02;
      checkmark.y = checkY;
      checkmark.alpha = checkAlpha;
      if (checkAlpha <= 0) {
        clearInterval(checkInterval);
        this.container.removeChild(checkmark);
        checkmark.destroy();
      }
    }, 16);

    // Play sound effect (if available)
    // TODO: Add SFX system and play 'button_click' sound
  }

  /**
   * Update HUD checkpoint display.
   */
  private updateHUDCheckpoints(): void {
    const ropeTier = this.playerState.equipment.rope;
    const maxCheckpoints = getMaxCheckpoints(ropeTier);
    const currentCheckpoints = this.playerState.checkpoints.length;
    this.hud.updateCheckpoints(currentCheckpoints, maxCheckpoints);
  }

  /**
   * Destroy a block and handle consequences.
   */
  private destroyBlock(x: number, y: number, block: Block): void {
    console.log(`Block destroyed at (${x}, ${y})`);

    // Emit dig burst particles at block world position
    const layer = getLayerAtDepth(y);
    const blockColor = parseInt(layer.color.replace('#', ''), 16);
    this.particleSystem.emit(ParticleSystem.DIG_BURST(
      { x: x * BLOCK_SIZE + BLOCK_SIZE / 2, y: y * BLOCK_SIZE + BLOCK_SIZE / 2 },
      blockColor
    ));

    // Handle TNT explosion
    if (block.type === BlockType.TNT) {
      this.handleTNTExplosion(x, y);
      return; // TNT handles its own destruction
    }

    // Roll for loot drop
    const itemDrop = rollLootDrop(y, this.rng);
    if (itemDrop) {
      this.createDrop(x, y, itemDrop);
      console.log(`Item dropped: ${itemDrop}`);
    }

    // Roll for random event
    const event = rollEvent(y, this.rng);
    if (event) {
      console.log(`Random event triggered: ${event.type}`);
      const eventResult = applyEvent(event, this.playerState, y, this.rng);
      this.handleEventResult(eventResult);
    }

    // Remove block from world
    const blockKey = `${x},${y}`;
    this.worldBlocks.delete(blockKey);

    // Update block in chunks
    const chunkY = Math.floor(y / 32);
    const chunk = this.loadedChunks.get(chunkY);
    if (chunk) {
      const localX = x % 20;
      const localY = y % 32;
      if (chunk.blocks[localX] && chunk.blocks[localX][localY]) {
        chunk.blocks[localX][localY].type = BlockType.EMPTY;
        chunk.blocks[localX][localY].hp = 0;
      }
    }

    // Apply gravity (player falls if block below them was destroyed)
    this.applyGravity();
  }

  /**
   * Handle TNT explosion with full visual effects and chain reactions.
   */
  private handleTNTExplosion(x: number, y: number): void {
    console.log('💥 TNT Explosion!');

    // Check if TNT was visible (within torch radius)
    const torchRadius = getTorchRadius(this.playerState.equipment.torch);
    const dx = Math.abs(this.playerState.position.x - x);
    const dy = Math.abs(this.playerState.position.y - y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const wasVisible = distance <= torchRadius;

    // Build world blocks map for explosion calculation
    const worldBlocksRecord: Record<string, Block> = {};
    this.worldBlocks.forEach((block, key) => {
      worldBlocksRecord[key] = block;
    });

    // Calculate full explosion with chain reactions
    const explosion = calculateFullExplosion(worldBlocksRecord, { x, y });

    console.log(`💥 Chain explosion: ${explosion.chainLength} TNT, ${explosion.totalBlocksDestroyed.length} blocks destroyed, -${explosion.totalGoldPenalty}g`);

    // If visible, play fuse animation first (300ms delay)
    if (wasVisible) {
      // Show panic face on player
      console.log('😱 Player sees TNT fuse!');

      // Play fuse animation
      ExplosionEffect.playFuse({ x, y }, this.container, () => {
        // After fuse completes, trigger explosion sequence
        this.executeExplosionSequence(explosion);
      });
    } else {
      // Instant explosion - no warning!
      console.log('💥 Hidden TNT - instant explosion!');
      this.executeExplosionSequence(explosion);
    }
  }

  /**
   * Execute the explosion sequence with chain reactions and visual effects.
   */
  private executeExplosionSequence(explosion: {
    phases: { center: Position; destroyedBlocks: Position[]; delay: number }[];
    totalBlocksDestroyed: Position[];
    totalGoldPenalty: number;
    totalLaunchDistance: number;
    chainLength: number;
  }): void {
    // Execute each explosion phase with proper delays
    explosion.phases.forEach((phase, phaseIndex) => {
      setTimeout(() => {
        // Play explosion effect for this phase
        ExplosionEffect.play(
          phase.center,
          this.app,
          this.container,
          (intensity, duration) => {
            // Intensify shake for chain reactions
            const shakeIntensity = intensity + phaseIndex * 2;
            this.cameraSystem.shake(shakeIntensity);
          },
          () => {
            // Explosion effect complete for this phase
            console.log(`Phase ${phaseIndex + 1} explosion effect complete`);
          }
        );

        // Destroy blocks in this phase
        phase.destroyedBlocks.forEach(pos => {
          const key = `${pos.x},${pos.y}`;
          this.worldBlocks.delete(key);

          // Update chunks
          const chunkY = Math.floor(pos.y / 32);
          const chunk = this.loadedChunks.get(chunkY);
          if (chunk) {
            const localX = pos.x % 20;
            const localY = pos.y % 32;
            if (chunk.blocks[localX] && chunk.blocks[localX][localY]) {
              chunk.blocks[localX][localY].type = BlockType.EMPTY;
              chunk.blocks[localX][localY].hp = 0;
            }
          }

          // Remove any drops in destroyed area
          this.activeDrops.forEach((drop, dropId) => {
            if (drop.position.x === pos.x && drop.position.y === pos.y) {
              this.itemDropRenderer.removeDrop(dropId);
              this.activeDrops.delete(dropId);
            }
          });
        });

        // Show gold penalty for this phase (stacked)
        const penaltyPerPhase = Math.floor(explosion.totalGoldPenalty / explosion.chainLength);
        const screenCenterX = this.app.screen.width / 2;
        const screenCenterY = this.app.screen.height / 2;
        ExplosionEffect.showGoldPenalty(
          `-${penaltyPerPhase} G`,
          screenCenterX,
          screenCenterY,
          this.container,
          phaseIndex * 40 // Stack penalties vertically
        );

        // On first explosion, launch player and apply effects
        if (phaseIndex === 0) {
          // Apply gold penalty
          this.playerState.gold = Math.max(0, this.playerState.gold - explosion.totalGoldPenalty);
          this.hud.updateGold(this.playerState.gold);

          // Show "BROKE!" if gold reaches 0
          if (this.playerState.gold === 0) {
            const brokeStyle = new TextStyle({
              fontFamily: 'Arial, sans-serif',
              fontSize: 36,
              fontWeight: 'bold',
              fill: '#FF0000',
              stroke: { color: '#000000', width: 6 }
            });
            const brokeText = new Text({ text: 'BROKE!', style: brokeStyle });
            brokeText.anchor.set(0.5);
            brokeText.x = screenCenterX;
            brokeText.y = screenCenterY + 100;
            this.container.addChild(brokeText);

            setTimeout(() => {
              this.container.removeChild(brokeText);
              brokeText.destroy();
            }, 2000);
          }

          // Launch player upward with smooth animation
          this.startPlayerLaunch(explosion.totalLaunchDistance);

          // Apply stun state
          this.playerState.isStunned = true;
          this.playerState.stunEndTime = Date.now() + STUN_DURATION;
          this.playerRenderer.playStunAnimation();

          // Remove stun after duration
          setTimeout(() => {
            this.playerState.isStunned = false;
            this.playerState.stunEndTime = null;
            console.log('Stun ended - player can move again');
          }, STUN_DURATION);
        }

        // Re-render world after each explosion
        this.renderWorld();
      }, phase.delay);
    });
  }

  /**
   * Start smooth player launch animation.
   */
  private startPlayerLaunch(launchDistance: number): void {
    this.isLaunching = true;
    this.launchStartY = this.playerState.position.y;
    this.launchTargetY = Math.max(0, this.playerState.position.y - launchDistance);
    this.launchProgress = 0;
  }

  /**
   * Update player launch animation (called from update loop).
   */
  private updatePlayerLaunch(deltaMs: number): void {
    if (!this.isLaunching) return;

    this.launchProgress += deltaMs;
    const progress = Math.min(this.launchProgress / this.launchDuration, 1);

    // Smooth easing (ease-out)
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    // Update player position
    this.playerState.position.y = this.launchStartY + (this.launchTargetY - this.launchStartY) * easedProgress;

    // Complete launch
    if (progress >= 1) {
      this.isLaunching = false;
      this.playerState.position.y = this.launchTargetY;
      console.log(`Player launched to depth ${this.launchTargetY}`);
    }
  }

  /**
   * Start ascent to surface with rope animation.
   */
  private startAscent(): void {
    const currentDepth = this.playerState.position.y;

    if (currentDepth <= 1) return; // Already at surface

    // Save last underground depth for rope descent
    this.playerState.maxDepthReached = Math.max(this.playerState.maxDepthReached, currentDepth);

    const ropeSpeed = getRopeSpeed(this.playerState.equipment.rope);
    const actualSpeed = ropeSpeed === -1 ? 50 : ropeSpeed; // blocks per second (-1 = instant = very fast)
    const distance = currentDepth - 1; // target y=1
    const duration = (distance / actualSpeed) * 1000; // ms

    console.log(`⬆️ Ascending from depth ${currentDepth} to surface at ${actualSpeed} blocks/sec (${(duration / 1000).toFixed(1)}s)`);

    this.isAscending = true;
    const startY = currentDepth;
    let elapsed = 0;

    // Show ascending text
    this.hud.showFloatingText('Ascending...', this.app.screen.width / 2, this.app.screen.height / 2, '#00FF00');

    // Draw rope line above player
    const ropeGraphic = new Graphics();
    this.app.stage.addChild(ropeGraphic);

    const ascentInterval = setInterval(() => {
      elapsed += 16;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out for smooth movement
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Move player upward
      this.playerState.position.y = startY - (distance * eased);

      // Update camera to follow
      const playerWorldX = this.playerState.position.x * 40;
      const playerWorldY = this.playerState.position.y * 40;
      this.cameraSystem.setPosition(playerWorldX, playerWorldY);

      // Draw rope visual (line from player going up)
      const screenCenterX = this.app.screen.width / 2;
      const screenCenterY = this.app.screen.height / 2;
      ropeGraphic.clear();
      ropeGraphic.moveTo(screenCenterX, 0);
      ropeGraphic.lineTo(screenCenterX, screenCenterY - 15);
      ropeGraphic.stroke({ width: 3, color: 0x8B6914, alpha: 0.8 });

      // Render
      this.renderWorld();
      this.hud.updateDepth(Math.floor(this.playerState.position.y));

      if (progress >= 1) {
        clearInterval(ascentInterval);
        this.isAscending = false;
        this.playerState.position.y = 1;
        this.playerState.isOnSurface = true;
        this.hud.updateDepth(1);

        // Remove rope visual
        this.app.stage.removeChild(ropeGraphic);
        ropeGraphic.destroy();

        console.log('✅ Reached surface!');

        // Auto-transition to sell screen
        if (this.onSurfaceCallback) {
          setTimeout(() => {
            if (this.onSurfaceCallback) {
              this.onSurfaceCallback();
            }
          }, 300);
        }
      }
    }, 16);
  }

  /**
   * Animate rope descent from surface to last depth.
   */
  private startRopeDescent(): void {
    const targetDepth = Math.max(10, this.playerState.maxDepthReached);
    const ropeSpeed = getRopeSpeed(this.playerState.equipment.rope);
    const actualSpeed = ropeSpeed === -1 ? 20 : ropeSpeed; // blocks per second

    console.log(`🪢 Rope descent to depth ${targetDepth} at ${actualSpeed} blocks/sec`);

    this.playerState.isOnSurface = false;
    this.isAscending = true; // Reuse ascent flag for descent

    const startY = this.playerState.position.y;
    const distance = targetDepth - startY;
    const duration = (distance / actualSpeed) * 1000; // ms

    let elapsed = 0;
    const descentInterval = setInterval(() => {
      elapsed += 16; // ~60fps
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Update player position
      this.playerState.position.y = startY + (distance * eased);

      // Update camera to follow
      const playerWorldY = this.playerState.position.y * 40;
      this.cameraSystem.setPosition(this.playerState.position.x * 40, playerWorldY);

      // Render
      this.renderWorld();
      this.hud.updateDepth(Math.floor(this.playerState.position.y));

      if (progress >= 1) {
        clearInterval(descentInterval);
        this.isAscending = false;
        this.playerState.position.y = targetDepth;
        this.applyGravity(); // Check for ground
        console.log(`✅ Rope descent complete at depth ${this.playerState.position.y}`);
      }
    }, 16);
  }

  /**
   * Fade to black and transition to surface.
   */
  private fadeToSurface(): void {
    // Create fade overlay
    const fade = new Graphics();
    fade.rect(0, 0, this.app.screen.width, this.app.screen.height);
    fade.fill({ color: 0x000000, alpha: 0 });
    this.app.stage.addChild(fade);

    let alpha = 0;
    const fadeInterval = setInterval(() => {
      alpha += 0.05;
      fade.alpha = Math.min(alpha, 1);

      if (alpha >= 1) {
        clearInterval(fadeInterval);
        // Transition to surface
        setTimeout(() => {
          if (this.onSurfaceCallback) {
            this.onSurfaceCallback();
          }
        }, 100);
      }
    }, 16);
  }


  /**
   * Handle random event results with visual effects.
   */
  private handleEventResult(eventResult: any): void {
    const effects = eventResult.effects;
    const eventType = eventResult.type;

    // Handle each event type with visual effects
    if (eventType === 'cave_in') {
      // Play cave-in visual effect
      EventEffects.playCaveIn(
        this.container,
        this.playerState.position,
        this.cameraSystem,
        eventResult.blocked
      );

      // Apply effects if not blocked
      if (!eventResult.blocked && effects.playerNewY !== undefined) {
        this.playerState.position.y = effects.playerNewY;

        // Show lost items as floating text
        if (effects.itemsLost && effects.itemsLost.length > 0) {
          const centerX = this.app.screen.width / 2;
          const centerY = this.app.screen.height / 2;
          effects.itemsLost.forEach((itemType: string, index: number) => {
            setTimeout(() => {
              this.hud.showFloatingText(
                `Lost ${itemType}!`,
                centerX,
                centerY + 50 + index * 25,
                '#FF0000'
              );
            }, index * 200);
          });
        }
      }
    } else if (eventType === 'gas_pocket') {
      // Play gas pocket visual effect
      EventEffects.playGasPocket(
        this.container,
        this.app,
        this.lightingSystem,
        eventResult.blocked
      );

      // Effects are handled by EventEffects (torch blackout)
    } else if (eventType === 'underground_spring') {
      // Spawn bonus items first
      if (effects.bonusItems) {
        effects.bonusItems.forEach((item: any) => {
          this.createDrop(item.position.x, item.position.y, item.itemType);
        });
      }

      // Play underground spring visual effect
      EventEffects.playUndergroundSpring(
        this.container,
        this.playerState.position,
        effects.bonusItems || []
      );
    } else if (eventType === 'treasure_chest') {
      // Spawn bonus items first
      if (effects.bonusItems) {
        effects.bonusItems.forEach((item: any) => {
          this.createDrop(item.position.x, item.position.y, item.itemType);
        });
      }

      // Play treasure chest visual effect
      EventEffects.playTreasureChest(
        this.container,
        this.playerState.position,
        effects.bonusItems || []
      );
    } else if (eventType === 'rock_slide') {
      // Play rock slide visual effect
      EventEffects.playRockSlide(
        this.container,
        this.app,
        this.cameraSystem,
        eventResult.blocked
      );

      // Apply effects if not blocked
      if (!eventResult.blocked && effects.hardnessBonus !== undefined) {
        this.rockSlideActive = true;
        this.rockSlideBlocksRemaining = effects.hardnessDuration || 0;
        this.rockSlideHardnessBonus = effects.hardnessBonus || 0;

        console.log(`Rock slide: +${this.rockSlideHardnessBonus} hardness for ${this.rockSlideBlocksRemaining} blocks`);
      }
    }
  }

  /**
   * Create a drop item at a position.
   */
  private createDrop(x: number, y: number, itemType: string): void {
    const drop: DropItem = {
      id: `drop_${Date.now()}_${Math.random()}`,
      itemType: itemType as any,
      position: { x, y },
      collectedBy: null,
      spawnedAt: Date.now()
    };

    this.activeDrops.set(drop.id, drop);

    // Add visual representation
    this.itemDropRenderer.addDrop(drop);

    console.log(`Drop created: ${itemType} at (${x}, ${y})`);
  }

  /**
   * Apply gravity to player.
   */
  private applyGravity(): void {
    // Check if block below player is empty
    const belowX = this.playerState.position.x;
    const belowY = this.playerState.position.y + 1;
    const belowKey = `${belowX},${belowY}`;
    const belowBlock = this.worldBlocks.get(belowKey);

    if (!belowBlock || belowBlock.type === BlockType.EMPTY) {
      // Player falls (snap down instantly)
      let newY = this.playerState.position.y;

      // Find first non-empty block below
      for (let y = this.playerState.position.y + 1; y < this.playerState.position.y + 10; y++) {
        const checkKey = `${belowX},${y}`;
        const checkBlock = this.worldBlocks.get(checkKey);

        if (checkBlock && checkBlock.type !== BlockType.EMPTY) {
          newY = y - 1;
          break;
        }
        newY = y;
      }

      if (newY !== this.playerState.position.y) {
        console.log(`Player fell from ${this.playerState.position.y} to ${newY}`);
        this.playerState.position.y = newY;
      }
    }
  }

  /**
   * Collect items that overlap player position.
   */
  private collectItems(): void {
    const playerPos = this.playerState.position;

    this.activeDrops.forEach((drop, id) => {
      const dx = Math.abs(drop.position.x - playerPos.x);
      const dy = Math.abs(drop.position.y - playerPos.y);

      // Check if player overlaps drop (within 1 block)
      if (dx <= 1 && dy <= 1) {
        // Try to add to inventory
        const result = addItem(this.playerState.inventory, drop.itemType, 1);

        if (result.success) {
          console.log(`Collected: ${drop.itemType}`);

          // Play collection animation and remove visual
          this.itemDropRenderer.removeDrop(id);
          this.activeDrops.delete(id);

          // Update HUD items bar
          this.hud.updateItems(this.playerState.inventory);

          // Show collection effect
          this.showFloatingText(
            this.app.screen.width / 2,
            this.app.screen.height / 2 - 50,
            `+${drop.itemType}`,
            0x00FF00
          );
        } else if (result.overflow > 0) {
          console.log('Inventory full!');
          this.showFloatingText(
            this.app.screen.width / 2,
            this.app.screen.height / 2,
            'Inventory Full!',
            0xFF0000
          );
        }
      }
    });
  }

  /**
   * Load chunks around the player.
   */
  private loadChunksAroundPlayer(): void {
    const playerChunkY = Math.floor(this.playerState.position.y / 32);

    // Load only current chunk + 1 below (2 chunks total = 128k blocks)
    for (let offset = 0; offset <= 1; offset++) {
      const chunkY = playerChunkY + offset;

      if (!this.loadedChunks.has(chunkY)) {
        this.loadChunk(chunkY);
      }
    }

    // Unload chunks far away (more than 2 chunks from player)
    const toUnload: number[] = [];
    this.loadedChunks.forEach((chunk, chunkY) => {
      if (Math.abs(chunkY - playerChunkY) > 2) {
        toUnload.push(chunkY);
      }
    });

    toUnload.forEach(chunkY => {
      console.log(`Unloading chunk ${chunkY}`);
      this.loadedChunks.delete(chunkY);
    });
  }

  /**
   * Load a single chunk.
   */
  private loadChunk(chunkY: number): void {
    console.log(`Loading chunk ${chunkY}`);

    const chunk = generateChunk(this.worldSeed, chunkY);
    this.loadedChunks.set(chunkY, chunk);

    // Add blocks to world blocks map
    for (let x = 0; x < chunk.blocks.length; x++) {
      for (let y = 0; y < chunk.blocks[x].length; y++) {
        const block = chunk.blocks[x][y];
        const key = `${block.x},${block.y}`;
        this.worldBlocks.set(key, block);
      }
    }
  }

  /**
   * Render depth-based background gradient behind blocks.
   * Color transitions between layer ambient colors for atmospheric feel.
   */
  private renderBackground(): void {
    this.bgGraphics.clear();

    const sh = this.app.screen.height;
    const offset = this.cameraSystem.getOffset();

    // We need to know the world-Y range visible on screen
    const topWorldY = -offset.y;
    const botWorldY = topWorldY + sh;

    // Draw gradient strips per ~4 block rows for performance
    const stripHeight = BLOCK_SIZE * 4;
    for (let worldY = topWorldY - stripHeight; worldY < botWorldY + stripHeight; worldY += stripHeight) {
      const depth = Math.max(0, Math.floor(worldY / BLOCK_SIZE));
      const layer = getLayerAtDepth(depth);
      const ambientColor = parseInt(layer.ambientColor.replace('#', ''), 16);

      // Darken ambient color for background (it should be subtle, behind blocks)
      const r = Math.floor(((ambientColor >> 16) & 0xFF) * 0.12);
      const g = Math.floor(((ambientColor >> 8) & 0xFF) * 0.12);
      const b = Math.floor((ambientColor & 0xFF) * 0.12);
      const bgColor = (r << 16) | (g << 8) | b;

      // Draw strip in world coordinates
      this.bgGraphics.rect(-2000, worldY, 4000, stripHeight);
      this.bgGraphics.fill(bgColor);
    }
  }

  /**
   * Render the world (blocks and player).
   * Only renders blocks visible on screen for performance.
   */
  private renderWorld(): void {
    // Render background gradient
    this.renderBackground();

    // Get visible block range from camera
    const visible = this.cameraSystem.getVisibleBlockRange();

    // Collect ONLY visible blocks
    const visibleBlocks: Block[][] = [];
    for (let x = visible.startX; x <= visible.endX; x++) {
      const column: Block[] = [];
      for (let y = visible.startY; y <= visible.endY; y++) {
        const block = this.worldBlocks.get(`${x},${y}`);
        if (block) {
          column.push(block);
        }
      }
      visibleBlocks.push(column);
    }

    // Render only visible blocks
    const torchRadius = getTorchRadius(this.playerState.equipment.torch);
    this.blockRenderer.renderChunk(
      visibleBlocks,
      0,
      0,
      this.playerState.position,
      torchRadius
    );

    // Apply camera offset to world container (blocks and items move)
    const offset = this.cameraSystem.getOffset();
    this.container.x = offset.x;
    this.container.y = offset.y;

    // Position player at screen center (player container is separate, doesn't move)
    const screenX = this.app.screen.width / 2;
    const screenY = this.app.screen.height / 2;
    this.playerRenderer.setPosition(screenX, screenY);

    // Update lighting position (follows player at screen center)
    this.lightingSystem.updatePosition(screenX, screenY);
  }

  /**
   * Update camera with smooth follow.
   */
  private updateCamera(deltaMs: number): void {
    // Convert player block position to world pixels (top-left of block)
    const targetWorldX = this.playerState.position.x * 40;
    const targetWorldY = this.playerState.position.y * 40;

    // Set camera target
    this.cameraSystem.setTarget(targetWorldX, targetWorldY);

    // Update camera (handles lerping and shake)
    this.cameraSystem.update(deltaMs);
  }

  /**
   * Show floating text at position.
   */
  private showFloatingText(x: number, y: number, text: string, color: number): void {
    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 20,
      fontWeight: 'bold',
      fill: color,
      stroke: { color: '#000000', width: 3 }
    });

    const floatingText = new Text({ text, style });
    floatingText.x = x;
    floatingText.y = y;
    floatingText.anchor.set(0.5);

    this.app.stage.addChild(floatingText);

    // Animate upward and fade out
    let elapsed = 0;
    const duration = 1000;

    const animate = () => {
      elapsed += 16; // ~60fps
      const progress = elapsed / duration;

      floatingText.y = y - progress * 50;
      floatingText.alpha = 1 - progress;

      if (progress >= 1) {
        this.app.stage.removeChild(floatingText);
      } else {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Update the scene (called every frame).
   */
  update(delta: number): void {
    // Convert delta from frames to milliseconds (assuming 60fps)
    const deltaMs = delta * 16.67;

    // Update player launch animation
    this.updatePlayerLaunch(deltaMs);

    // Update camera (skip during ascent/descent - those control camera directly)
    if (!this.isAscending) {
      this.updateCamera(deltaMs);
    }

    // Update item drop renderer with camera offset
    const cameraOffset = this.cameraSystem.getOffset();
    this.itemDropRenderer.update(deltaMs, cameraOffset);

    // Update particle system
    this.particleSystem.update(deltaMs);

    // Update player renderer
    this.playerRenderer.update(delta);

    // Update lighting system
    this.lightingSystem.update(delta);

    // Update HUD
    this.hud.update(deltaMs);
    this.hud.updateDepth(this.playerState.position.y);

    // Update inventory panel
    this.inventoryPanel.update(deltaMs);

    // Apply gravity (skip during launch and ascent/descent animations)
    if (!this.isLaunching && !this.isAscending) {
      this.applyGravity();
    }

    // Collect items
    this.collectItems();

    // Load/unload chunks
    this.loadChunksAroundPlayer();

    // Render world
    this.renderWorld();
  }

  /**
   * Set callback for surface button click.
   */
  setSurfaceCallback(callback: () => void): void {
    this.onSurfaceCallback = callback;
  }

  /**
   * Clean up the scene.
   */
  destroy(): void {
    this.app.stage.off('pointerdown', this.clickHandler);
    window.removeEventListener('keydown', this.keyHandler);
    this.blockRenderer.clear();
    this.particleSystem.destroy();
    this.playerRenderer.destroy();
    this.itemDropRenderer.destroy();
    this.lightingSystem.destroy();
    this.hud.destroy();
    this.inventoryPanel.destroy();
    this.checkpointReplacePanel.destroy();
    this.app.stage.removeChild(this.container);
  }
}
