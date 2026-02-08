import { Container, Graphics, Ticker } from 'pixi.js';
import { EquipmentSlot, EquipmentTier } from '@shared/types';
import { STUN_DURATION } from '@shared/constants';

/**
 * PlayerRenderer draws and animates the player character.
 * Uses procedural graphics to create a Pixar-style miner character
 * with equipment-based visual variations and smooth animations.
 */
export class PlayerRenderer {
  private container: Container;
  private characterContainer: Container;

  // Character parts
  private head: Graphics;
  private leftEye: Graphics;
  private rightEye: Graphics;
  private body: Graphics;
  private helmet: Graphics;
  private leftArm: Graphics;
  private rightArm: Graphics;
  private shovel: Graphics;
  private torch: Graphics;
  private torchGlow: Graphics;

  // Animation state
  private currentAnimation: 'idle' | 'dig' | 'stun' | 'celebration' | null = null;
  private animationTimer = 0;
  private idleTimer = 0;
  private blinkTimer = 0;
  private nextBlinkTime = 3000;
  private direction: 'left' | 'right' | 'down' = 'right';

  // Animation callback references for cleanup
  private idleAnimationCallback: ((ticker: Ticker) => void) | null = null;
  private digAnimationCallback: ((ticker: Ticker) => void) | null = null;
  private stunAnimationCallback: ((ticker: Ticker) => void) | null = null;
  private celebrationAnimationCallback: ((ticker: Ticker) => void) | null = null;

  // Equipment state
  private equipment: Record<EquipmentSlot, EquipmentTier> = {
    [EquipmentSlot.SHOVEL]: 1,
    [EquipmentSlot.HELMET]: 1,
    [EquipmentSlot.VEST]: 1,
    [EquipmentSlot.TORCH]: 1,
    [EquipmentSlot.ROPE]: 1
  };

  // Character dimensions
  private readonly headRadius = 7;
  private readonly bodyWidth = 16;
  private readonly bodyHeight = 14;
  private readonly eyeRadius = 1.5;
  private readonly armWidth = 4;
  private readonly armHeight = 10;

  constructor(stage: Container) {
    this.container = new Container();
    this.characterContainer = new Container();
    this.container.addChild(this.characterContainer);
    stage.addChild(this.container);

    // Create character parts
    this.head = new Graphics();
    this.leftEye = new Graphics();
    this.rightEye = new Graphics();
    this.body = new Graphics();
    this.helmet = new Graphics();
    this.leftArm = new Graphics();
    this.rightArm = new Graphics();
    this.shovel = new Graphics();
    this.torch = new Graphics();
    this.torchGlow = new Graphics();

    // Add parts to character container (order matters for layering)
    this.characterContainer.addChild(this.torchGlow);
    this.characterContainer.addChild(this.torch);
    this.characterContainer.addChild(this.leftArm);
    this.characterContainer.addChild(this.shovel);
    this.characterContainer.addChild(this.body);
    this.characterContainer.addChild(this.rightArm);
    this.characterContainer.addChild(this.head);
    this.characterContainer.addChild(this.helmet);
    this.characterContainer.addChild(this.leftEye);
    this.characterContainer.addChild(this.rightEye);

    // Draw initial character
    this.drawCharacter();

    // Start idle animation
    this.playIdleAnimation();
  }

  /**
   * Draw the character based on current equipment.
   */
  private drawCharacter(): void {
    // Clear all parts
    this.head.clear();
    this.leftEye.clear();
    this.rightEye.clear();
    this.body.clear();
    this.helmet.clear();
    this.leftArm.clear();
    this.rightArm.clear();
    this.shovel.clear();
    this.torch.clear();
    this.torchGlow.clear();

    // Draw head (PixiJS v8)
    this.head.circle(0, 0, this.headRadius);
    this.head.fill(0xFFD5B8); // Skin color
    this.head.y = -18;

    // Draw eyes (big Pixar-style)
    const eyeOffsetX = 3;
    const eyeOffsetY = -18;

    this.leftEye.circle(-eyeOffsetX, eyeOffsetY, this.eyeRadius);
    this.leftEye.fill(0x000000);

    this.rightEye.circle(eyeOffsetX, eyeOffsetY, this.eyeRadius);
    this.rightEye.fill(0x000000);

    // Draw body (color based on vest tier)
    const vestColor = this.getVestColor();
    this.body.roundRect(
      -this.bodyWidth / 2,
      -this.bodyHeight / 2,
      this.bodyWidth,
      this.bodyHeight,
      3
    );
    this.body.fill(vestColor);
    this.body.y = -4;

    // Draw helmet (color based on helmet tier)
    const helmetColor = this.getHelmetColor();
    this.helmet.arc(0, -18, this.headRadius + 2, Math.PI, 0);
    this.helmet.stroke({ width: 3, color: helmetColor });
    this.helmet.y = 0;

    // Draw arms
    const armColor = 0xFFD5B8; // Skin color
    this.leftArm.roundRect(0, 0, this.armWidth, this.armHeight, 2);
    this.leftArm.fill(armColor);
    this.leftArm.x = -this.bodyWidth / 2 - 2;
    this.leftArm.y = -8;

    this.rightArm.roundRect(0, 0, this.armWidth, this.armHeight, 2);
    this.rightArm.fill(armColor);
    this.rightArm.x = this.bodyWidth / 2 - 2;
    this.rightArm.y = -8;

    // Draw shovel (color based on shovel tier)
    const shovelColor = this.getShovelColor();
    this.shovel.moveTo(0, 0);
    this.shovel.lineTo(0, 8);
    this.shovel.stroke({ width: 3, color: shovelColor });
    this.shovel.rect(-3, 8, 6, 4);
    this.shovel.fill(shovelColor);
    this.shovel.x = this.bodyWidth / 2;
    this.shovel.y = 0;

    // Draw torch (size/color based on torch tier)
    const torchSize = 2 + this.equipment[EquipmentSlot.TORCH] * 0.5;
    const torchColor = this.getTorchColor();

    this.torch.circle(0, 0, torchSize);
    this.torch.fill(torchColor);
    this.torch.x = -this.bodyWidth / 2 - 4;
    this.torch.y = 0;

    // Draw torch glow
    this.torchGlow.circle(0, 0, torchSize * 2);
    this.torchGlow.fill({ color: torchColor, alpha: 0.3 });
    this.torchGlow.x = this.torch.x;
    this.torchGlow.y = this.torch.y;
  }

  /**
   * Get vest color based on tier.
   */
  private getVestColor(): number {
    const tier = this.equipment[EquipmentSlot.VEST];
    const colors = [
      0x8B4513, // Tier 1: Brown
      0x654321, // Tier 2: Dark brown
      0x4A4A4A, // Tier 3: Gray
      0x2F4F4F, // Tier 4: Dark slate
      0x483D8B, // Tier 5: Dark slate blue
      0x4B0082, // Tier 6: Indigo
      0x8B008B  // Tier 7: Dark magenta
    ];
    return colors[tier - 1] || colors[0];
  }

  /**
   * Get helmet color based on tier.
   */
  private getHelmetColor(): number {
    const tier = this.equipment[EquipmentSlot.HELMET];
    const colors = [
      0xD3D3D3, // Tier 1: Light gray
      0xC0C0C0, // Tier 2: Silver
      0xFFD700, // Tier 3: Gold
      0xFF8C00, // Tier 4: Dark orange
      0xFF4500, // Tier 5: Orange red
      0xFF1493, // Tier 6: Deep pink
      0x9400D3  // Tier 7: Dark violet
    ];
    return colors[tier - 1] || colors[0];
  }

  /**
   * Get shovel color based on tier.
   */
  private getShovelColor(): number {
    const tier = this.equipment[EquipmentSlot.SHOVEL];
    const colors = [
      0x8B7355, // Tier 1: Wood brown
      0xA0522D, // Tier 2: Sienna
      0xC0C0C0, // Tier 3: Silver
      0xFFD700, // Tier 4: Gold
      0x00CED1, // Tier 5: Dark turquoise
      0x9370DB, // Tier 6: Medium purple
      0xFF69B4  // Tier 7: Hot pink
    ];
    return colors[tier - 1] || colors[0];
  }

  /**
   * Get torch color based on tier.
   */
  private getTorchColor(): number {
    const tier = this.equipment[EquipmentSlot.TORCH];
    const colors = [
      0xFFAA00, // Tier 1: Orange
      0xFFCC00, // Tier 2: Light orange
      0xFFFF00, // Tier 3: Yellow
      0xFFFFAA, // Tier 4: Light yellow
      0xFFFFFF, // Tier 5: White
      0xCCFFFF, // Tier 6: Cyan white
      0xAAFFFF  // Tier 7: Bright cyan
    ];
    return colors[tier - 1] || colors[0];
  }

  /**
   * Set the player's screen position.
   *
   * @param x - Screen X coordinate in pixels
   * @param y - Screen Y coordinate in pixels
   */
  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  /**
   * Update equipment and redraw character.
   *
   * @param equipment - Current equipment state
   */
  setEquipment(equipment: Record<EquipmentSlot, EquipmentTier>): void {
    this.equipment = equipment;
    this.drawCharacter();
  }

  /**
   * Play the digging animation.
   * Squash and stretch with arm swing.
   */
  playDigAnimation(): void {
    if (this.currentAnimation === 'dig') return;

    this.currentAnimation = 'dig';
    this.animationTimer = 0;

    // Remove previous dig animation if any
    if (this.digAnimationCallback) {
      Ticker.shared.remove(this.digAnimationCallback);
    }

    this.digAnimationCallback = (ticker: Ticker) => {
      // Null check for destroyed state
      if (!this.body) {
        if (this.digAnimationCallback) {
          ticker.remove(this.digAnimationCallback);
        }
        return;
      }

      this.animationTimer += ticker.deltaMS;

      const progress = Math.min(this.animationTimer / 200, 1);
      const eased = this.easeInOutQuad(progress);

      // Squash and stretch
      const squash = 1 - 0.1 * Math.sin(eased * Math.PI);
      this.body.scale.y = squash;
      this.body.scale.x = 1 + (1 - squash) * 0.5;

      // Arm swing
      const swing = Math.sin(eased * Math.PI) * 0.3;
      this.rightArm.rotation = swing;
      this.shovel.rotation = swing;

      if (progress >= 1) {
        // Reset
        this.body.scale.set(1, 1);
        this.rightArm.rotation = 0;
        this.shovel.rotation = 0;
        this.currentAnimation = null;
        if (this.digAnimationCallback) {
          ticker.remove(this.digAnimationCallback);
        }
      }
    };

    Ticker.shared.add(this.digAnimationCallback);
  }

  /**
   * Play the stun animation.
   * Character tumbles with spinning stars.
   */
  playStunAnimation(): void {
    if (this.currentAnimation === 'stun') return;

    this.currentAnimation = 'stun';
    this.animationTimer = 0;

    // Remove previous stun animation if any
    if (this.stunAnimationCallback) {
      Ticker.shared.remove(this.stunAnimationCallback);
    }

    // Create stars
    const stars: Graphics[] = [];
    for (let i = 0; i < 3; i++) {
      const star = new Graphics();
      this.drawStar(star, 0, 0, 5, 4, 2);
      star.fill(0xFFFF00);
      this.characterContainer.addChild(star);
      stars.push(star);
    }

    this.stunAnimationCallback = (ticker: Ticker) => {
      // Null check for destroyed state
      if (!this.characterContainer) {
        stars.forEach(star => star.destroy());
        if (this.stunAnimationCallback) {
          ticker.remove(this.stunAnimationCallback);
        }
        return;
      }

      this.animationTimer += ticker.deltaMS;

      const progress = this.animationTimer / STUN_DURATION;

      // Tumble rotation
      this.characterContainer.rotation = Math.sin(progress * Math.PI * 4) * 0.3;

      // Orbiting stars
      stars.forEach((star, i) => {
        const angle = (progress * Math.PI * 2) + (i * Math.PI * 2 / 3);
        star.x = Math.cos(angle) * 20;
        star.y = -20 + Math.sin(angle) * 20;
        star.rotation = angle;
      });

      if (this.animationTimer >= STUN_DURATION) {
        // Reset
        this.characterContainer.rotation = 0;
        stars.forEach(star => star.destroy());
        this.currentAnimation = null;
        if (this.stunAnimationCallback) {
          ticker.remove(this.stunAnimationCallback);
        }
      }
    };

    Ticker.shared.add(this.stunAnimationCallback);
  }

  /**
   * Play the idle animation.
   * Subtle breathing and occasional blinking.
   */
  playIdleAnimation(): void {
    this.currentAnimation = 'idle';

    // Remove previous idle animation if any
    if (this.idleAnimationCallback) {
      Ticker.shared.remove(this.idleAnimationCallback);
    }

    this.idleAnimationCallback = (ticker: Ticker) => {
      // Null check for destroyed state
      if (this.currentAnimation !== 'idle' || !this.body) {
        if (this.idleAnimationCallback) {
          ticker.remove(this.idleAnimationCallback);
        }
        return;
      }

      this.idleTimer += ticker.deltaMS;
      this.blinkTimer += ticker.deltaMS;

      // Breathing animation (2 second cycle)
      const breathProgress = (this.idleTimer % 2000) / 2000;
      const breathScale = 1 + 0.02 * Math.sin(breathProgress * Math.PI * 2);
      this.body.scale.y = breathScale;

      // Blinking
      if (this.blinkTimer >= this.nextBlinkTime) {
        this.blink();
        this.blinkTimer = 0;
        this.nextBlinkTime = 3000 + Math.random() * 2000; // 3-5 seconds
      }
    };

    Ticker.shared.add(this.idleAnimationCallback);
  }

  /**
   * Play the celebration animation.
   * Fist pump with sparkles.
   */
  playCelebrationAnimation(): void {
    if (this.currentAnimation === 'celebration') return;

    this.currentAnimation = 'celebration';
    this.animationTimer = 0;

    // Remove previous celebration animation if any
    if (this.celebrationAnimationCallback) {
      Ticker.shared.remove(this.celebrationAnimationCallback);
    }

    // Create sparkle particles
    const sparkles: Graphics[] = [];
    for (let i = 0; i < 5; i++) {
      const sparkle = new Graphics();
      sparkle.circle(0, 0, 2);
      sparkle.fill(0xFFD700);
      this.characterContainer.addChild(sparkle);
      sparkles.push(sparkle);
    }

    this.celebrationAnimationCallback = (ticker: Ticker) => {
      // Null check for destroyed state
      if (!this.rightArm || !this.characterContainer) {
        sparkles.forEach(sparkle => sparkle.destroy());
        if (this.celebrationAnimationCallback) {
          ticker.remove(this.celebrationAnimationCallback);
        }
        return;
      }

      this.animationTimer += ticker.deltaMS;

      const progress = Math.min(this.animationTimer / 600, 1);

      // Fist pump (right arm raises)
      const raise = -Math.sin(progress * Math.PI) * 10;
      this.rightArm.y = -8 + raise;

      // Sparkles rise and fade
      sparkles.forEach((sparkle, i) => {
        const delay = i * 0.1;
        const sparkleProgress = Math.max(0, progress - delay);
        sparkle.x = this.bodyWidth / 2 + (Math.random() - 0.5) * 10;
        sparkle.y = -10 - sparkleProgress * 20;
        sparkle.alpha = 1 - sparkleProgress;
      });

      if (progress >= 1) {
        // Reset
        this.rightArm.y = -8;
        sparkles.forEach(sparkle => sparkle.destroy());
        this.currentAnimation = null;
        if (this.celebrationAnimationCallback) {
          ticker.remove(this.celebrationAnimationCallback);
        }
        this.playIdleAnimation();
      }
    };

    Ticker.shared.add(this.celebrationAnimationCallback);
  }

  /**
   * Set the character's facing direction.
   *
   * @param dir - Direction to face
   */
  setDirection(dir: 'left' | 'right' | 'down'): void {
    this.direction = dir;

    if (dir === 'left') {
      this.characterContainer.scale.x = -1;
    } else {
      this.characterContainer.scale.x = 1;
    }

    // Down direction could modify the character's pose in the future
  }

  /**
   * Blink animation.
   */
  private blink(): void {
    // Close eyes
    this.leftEye.scale.y = 0.1;
    this.rightEye.scale.y = 0.1;

    // Open eyes after 100ms
    setTimeout(() => {
      this.leftEye.scale.y = 1;
      this.rightEye.scale.y = 1;
    }, 100);
  }

  /**
   * Draw a star shape.
   */
  private drawStar(
    graphics: Graphics,
    x: number,
    y: number,
    points: number,
    outerRadius: number,
    innerRadius: number
  ): void {
    const step = Math.PI / points;
    let rotation = -Math.PI / 2;

    graphics.moveTo(x, y - outerRadius);

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = rotation + step * i;
      graphics.lineTo(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius
      );
    }

    graphics.closePath();
  }

  /**
   * Easing function for smooth animations.
   */
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Update method for any continuous animations.
   */
  update(delta: number): void {
    // Torch glow pulsing
    const pulseScale = 1 + 0.1 * Math.sin(Date.now() / 200);
    this.torchGlow.scale.set(pulseScale, pulseScale);
  }

  /**
   * Clean up the renderer.
   */
  destroy(): void {
    // Remove all ticker callbacks first to prevent null reference errors
    if (this.idleAnimationCallback) {
      Ticker.shared.remove(this.idleAnimationCallback);
      this.idleAnimationCallback = null;
    }
    if (this.digAnimationCallback) {
      Ticker.shared.remove(this.digAnimationCallback);
      this.digAnimationCallback = null;
    }
    if (this.stunAnimationCallback) {
      Ticker.shared.remove(this.stunAnimationCallback);
      this.stunAnimationCallback = null;
    }
    if (this.celebrationAnimationCallback) {
      Ticker.shared.remove(this.celebrationAnimationCallback);
      this.celebrationAnimationCallback = null;
    }

    // Reset animation state
    this.currentAnimation = null;

    // Now destroy graphics objects
    this.characterContainer.destroy({ children: true });
    this.container.destroy({ children: true });
  }
}
