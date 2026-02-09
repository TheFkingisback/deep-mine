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
  private leftLeg: Graphics;
  private rightLeg: Graphics;

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

  // Character dimensions (bigger for full body visibility)
  private readonly headRadius = 10;
  private readonly bodyWidth = 22;
  private readonly bodyHeight = 20;
  private readonly eyeRadius = 2;
  private readonly armWidth = 6;
  private readonly armHeight = 14;
  private readonly legWidth = 7;
  private readonly legHeight = 10;

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
    this.leftLeg = new Graphics();
    this.rightLeg = new Graphics();

    // Add parts to character container (order matters for layering)
    this.characterContainer.addChild(this.torchGlow);
    this.characterContainer.addChild(this.torch);
    this.characterContainer.addChild(this.leftLeg);
    this.characterContainer.addChild(this.rightLeg);
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
    this.leftLeg.clear();
    this.rightLeg.clear();

    // === HEAD ===
    // Head shadow (behind head for depth)
    this.head.circle(0.5, 0.5, this.headRadius);
    this.head.fill({ color: 0xCC9977, alpha: 0.5 });
    // Main head
    this.head.circle(0, 0, this.headRadius);
    this.head.fill(0xFFD5B8);
    // Cheek highlight
    this.head.circle(-3, 2, 3);
    this.head.fill({ color: 0xFFE8D8, alpha: 0.4 });
    this.head.y = -28;

    // === EYES (big Pixar-style) ===
    // White sclera
    this.leftEye.circle(-4, -28, this.eyeRadius + 1.5);
    this.leftEye.fill(0xFFFFFF);
    this.leftEye.circle(-4, -28, this.eyeRadius + 1.5);
    this.leftEye.stroke({ width: 0.5, color: 0xCCCCCC });
    // Iris
    this.leftEye.circle(-4, -28, this.eyeRadius);
    this.leftEye.fill(0x4466AA);
    // Pupil
    this.leftEye.circle(-4, -28, this.eyeRadius * 0.6);
    this.leftEye.fill(0x000000);
    // Eye shine
    this.leftEye.circle(-3, -29, 1);
    this.leftEye.fill(0xFFFFFF);

    this.rightEye.circle(4, -28, this.eyeRadius + 1.5);
    this.rightEye.fill(0xFFFFFF);
    this.rightEye.circle(4, -28, this.eyeRadius + 1.5);
    this.rightEye.stroke({ width: 0.5, color: 0xCCCCCC });
    this.rightEye.circle(4, -28, this.eyeRadius);
    this.rightEye.fill(0x4466AA);
    this.rightEye.circle(4, -28, this.eyeRadius * 0.6);
    this.rightEye.fill(0x000000);
    this.rightEye.circle(5, -29, 1);
    this.rightEye.fill(0xFFFFFF);

    // === HELMET ===
    const helmetColor = this.getHelmetColor();
    const helmetDark = this.darkenColor(helmetColor, 0.3);
    const helmetLight = this.lightenColor(helmetColor, 0.3);
    // Helmet dome
    this.helmet.arc(0, -28, this.headRadius + 3, Math.PI, 0);
    this.helmet.fill(helmetColor);
    // Highlight strip on top
    this.helmet.arc(0, -28, this.headRadius + 1, Math.PI + 0.3, -0.3);
    this.helmet.fill({ color: helmetLight, alpha: 0.4 });
    // Helmet brim with depth
    this.helmet.rect(-this.headRadius - 4, -28, (this.headRadius + 4) * 2, 4);
    this.helmet.fill(helmetDark);
    this.helmet.rect(-this.headRadius - 4, -28, (this.headRadius + 4) * 2, 2);
    this.helmet.fill(helmetColor);
    // Headlamp mount (small circle on front)
    this.helmet.circle(0, -30, 2.5);
    this.helmet.fill(0xCCCCCC);
    this.helmet.circle(0, -30, 1.5);
    this.helmet.fill(0xFFFF88);

    // === BODY (vest) ===
    const vestColor = this.getVestColor();
    const vestDark = this.darkenColor(vestColor, 0.25);
    const vestLight = this.lightenColor(vestColor, 0.2);
    // Body shadow
    this.body.roundRect(-this.bodyWidth / 2 + 1, -this.bodyHeight / 2 + 1, this.bodyWidth, this.bodyHeight, 4);
    this.body.fill({ color: 0x000000, alpha: 0.2 });
    // Main body
    this.body.roundRect(-this.bodyWidth / 2, -this.bodyHeight / 2, this.bodyWidth, this.bodyHeight, 4);
    this.body.fill(vestColor);
    // Vest highlight (left edge)
    this.body.roundRect(-this.bodyWidth / 2, -this.bodyHeight / 2, 4, this.bodyHeight, 4);
    this.body.fill({ color: vestLight, alpha: 0.3 });
    // Vest shadow (right edge)
    this.body.roundRect(this.bodyWidth / 2 - 4, -this.bodyHeight / 2, 4, this.bodyHeight, 4);
    this.body.fill({ color: vestDark, alpha: 0.3 });
    // Belt
    this.body.rect(-this.bodyWidth / 2, this.bodyHeight / 2 - 5, this.bodyWidth, 5);
    this.body.fill(0x5a3a1a);
    // Belt buckle
    this.body.rect(-2, this.bodyHeight / 2 - 4, 4, 3);
    this.body.fill(0xCCAA44);
    this.body.y = -8;

    // === LEGS ===
    const pantsColor = 0x4A6FA5;
    const pantsDark = this.darkenColor(pantsColor, 0.2);
    this.leftLeg.roundRect(0, 0, this.legWidth, this.legHeight, 2);
    this.leftLeg.fill(pantsColor);
    // Inner shadow
    this.leftLeg.roundRect(this.legWidth - 2, 0, 2, this.legHeight, 1);
    this.leftLeg.fill({ color: pantsDark, alpha: 0.4 });
    // Boot
    this.leftLeg.roundRect(-1, this.legHeight - 4, this.legWidth + 2, 5, 2);
    this.leftLeg.fill(0x3a2510);
    // Boot highlight
    this.leftLeg.roundRect(-1, this.legHeight - 4, this.legWidth + 2, 2, 1);
    this.leftLeg.fill({ color: 0x5a4530, alpha: 0.5 });
    this.leftLeg.x = -this.legWidth - 1;
    this.leftLeg.y = 2;

    this.rightLeg.roundRect(0, 0, this.legWidth, this.legHeight, 2);
    this.rightLeg.fill(pantsColor);
    this.rightLeg.roundRect(0, 0, 2, this.legHeight, 1);
    this.rightLeg.fill({ color: pantsDark, alpha: 0.4 });
    this.rightLeg.roundRect(-1, this.legHeight - 4, this.legWidth + 2, 5, 2);
    this.rightLeg.fill(0x3a2510);
    this.rightLeg.roundRect(-1, this.legHeight - 4, this.legWidth + 2, 2, 1);
    this.rightLeg.fill({ color: 0x5a4530, alpha: 0.5 });
    this.rightLeg.x = 1;
    this.rightLeg.y = 2;

    // === ARMS ===
    const armColor = 0xFFD5B8;
    const armDark = 0xDDB598;
    this.leftArm.roundRect(0, 0, this.armWidth, this.armHeight, 3);
    this.leftArm.fill(armColor);
    // Arm shadow
    this.leftArm.roundRect(this.armWidth - 2, 0, 2, this.armHeight, 2);
    this.leftArm.fill({ color: armDark, alpha: 0.4 });
    this.leftArm.x = -this.bodyWidth / 2 - this.armWidth + 1;
    this.leftArm.y = -16;

    this.rightArm.roundRect(0, 0, this.armWidth, this.armHeight, 3);
    this.rightArm.fill(armColor);
    this.rightArm.roundRect(0, 0, 2, this.armHeight, 2);
    this.rightArm.fill({ color: armDark, alpha: 0.4 });
    this.rightArm.x = this.bodyWidth / 2 - 1;
    this.rightArm.y = -16;

    // === PICKAXE (held by right arm) ===
    const shovelColor = this.getShovelColor();
    const shovelDark = this.darkenColor(shovelColor, 0.3);
    // Handle (wooden stick with grain)
    this.shovel.moveTo(0, -2);
    this.shovel.lineTo(16, -18);
    this.shovel.stroke({ width: 3.5, color: 0x6B4226 });
    this.shovel.moveTo(0, -2);
    this.shovel.lineTo(16, -18);
    this.shovel.stroke({ width: 2, color: 0x8B5A2B });
    // Metal head joint
    this.shovel.circle(16, -18, 2.5);
    this.shovel.fill(shovelDark);
    // Pick blade (forward)
    this.shovel.moveTo(16, -18);
    this.shovel.lineTo(27, -22);
    this.shovel.lineTo(27, -20);
    this.shovel.lineTo(16, -17);
    this.shovel.closePath();
    this.shovel.fill(shovelColor);
    this.shovel.moveTo(16, -18);
    this.shovel.lineTo(27, -22);
    this.shovel.stroke({ width: 1, color: shovelDark });
    // Pick spike (back)
    this.shovel.moveTo(16, -18);
    this.shovel.lineTo(9, -24);
    this.shovel.stroke({ width: 3, color: shovelColor });
    this.shovel.moveTo(16, -18);
    this.shovel.lineTo(9, -24);
    this.shovel.stroke({ width: 1.5, color: shovelDark });
    // Pivot
    this.shovel.x = this.bodyWidth / 2 + 2;
    this.shovel.y = -10;
    this.shovel.pivot.set(0, -2);

    // === TORCH ===
    const torchSize = 3 + this.equipment[EquipmentSlot.TORCH] * 0.5;
    const torchColor = this.getTorchColor();
    // Torch handle
    this.torch.moveTo(0, 8);
    this.torch.lineTo(0, -1);
    this.torch.stroke({ width: 3, color: 0x6B4226 });
    this.torch.moveTo(0, 8);
    this.torch.lineTo(0, -1);
    this.torch.stroke({ width: 1.5, color: 0x8B5A2B });
    // Flame outer glow
    this.torch.circle(0, -4, torchSize + 1);
    this.torch.fill({ color: torchColor, alpha: 0.4 });
    // Flame main
    this.torch.circle(0, -4, torchSize);
    this.torch.fill(torchColor);
    // Flame inner bright core
    this.torch.circle(0, -4.5, torchSize * 0.5);
    this.torch.fill({ color: 0xFFFFCC, alpha: 0.7 });
    this.torch.x = -this.bodyWidth / 2 - this.armWidth;
    this.torch.y = -12;

    // Torch glow (larger, softer)
    this.torchGlow.circle(0, 0, torchSize * 4);
    this.torchGlow.fill({ color: torchColor, alpha: 0.08 });
    this.torchGlow.circle(0, 0, torchSize * 2.5);
    this.torchGlow.fill({ color: torchColor, alpha: 0.12 });
    this.torchGlow.x = this.torch.x;
    this.torchGlow.y = this.torch.y - 4;
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

      const progress = Math.min(this.animationTimer / 300, 1);

      // Pickaxe swing: wind up (0-40%), strike down (40-70%), bounce back (70-100%)
      let swingAngle = 0;
      if (progress < 0.4) {
        // Wind up - raise pickaxe
        const p = progress / 0.4;
        swingAngle = -0.8 * p;
      } else if (progress < 0.7) {
        // Strike down - fast swing
        const p = (progress - 0.4) / 0.3;
        swingAngle = -0.8 + 1.4 * p;
      } else {
        // Bounce back to rest
        const p = (progress - 0.7) / 0.3;
        swingAngle = 0.6 * (1 - p);
      }

      this.rightArm.rotation = swingAngle * 0.5;
      this.shovel.rotation = swingAngle;

      // Body leans into swing
      this.characterContainer.rotation = swingAngle * 0.05;

      // Squash on impact (at progress 0.7)
      if (progress > 0.6 && progress < 0.8) {
        const impactP = (progress - 0.6) / 0.2;
        this.body.scale.y = 1 - 0.08 * Math.sin(impactP * Math.PI);
        this.body.scale.x = 1 + 0.04 * Math.sin(impactP * Math.PI);
      } else {
        this.body.scale.set(1, 1);
      }

      if (progress >= 1) {
        // Reset
        this.body.scale.set(1, 1);
        this.rightArm.rotation = 0;
        this.shovel.rotation = 0;
        this.characterContainer.rotation = 0;
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
   * Darken a color by a percentage.
   */
  private darkenColor(color: number, percent: number): number {
    const r = Math.max(0, Math.floor(((color >> 16) & 0xFF) * (1 - percent)));
    const g = Math.max(0, Math.floor(((color >> 8) & 0xFF) * (1 - percent)));
    const b = Math.max(0, Math.floor((color & 0xFF) * (1 - percent)));
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Lighten a color by a percentage.
   */
  private lightenColor(color: number, percent: number): number {
    const r = Math.min(255, Math.floor(((color >> 16) & 0xFF) * (1 + percent)));
    const g = Math.min(255, Math.floor(((color >> 8) & 0xFF) * (1 + percent)));
    const b = Math.min(255, Math.floor((color & 0xFF) * (1 + percent)));
    return (r << 16) | (g << 8) | b;
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
