import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Position, ItemType } from '@shared/types';
import { BLOCK_SIZE, GAS_POCKET_DURATION } from '@shared/constants';
import { ITEMS } from '@shared/items';
import { CameraSystem } from '../systems/CameraSystem';
import { LightingSystem } from '../systems/LightingSystem';

/**
 * EventEffects provides visual feedback for all random mining events.
 * Each event has unique animations, sounds, and screen effects.
 */
export class EventEffects {
  /**
   * Play cave-in event effect.
   * Rocks fall, dust cloud, camera shake, player is pushed upward.
   *
   * @param container - Container to add effects to
   * @param playerPos - Player's position in blocks
   * @param cameraSystem - Camera system for shake effect
   * @param blocked - Whether event was blocked by vest
   */
  static playCaveIn(
    container: Container,
    playerPos: Position,
    cameraSystem: CameraSystem,
    blocked: boolean
  ): void {
    console.log('🪨 CAVE-IN!', blocked ? '(BLOCKED)' : '');

    if (blocked) {
      // Show protection banner
      this.showBanner(container, 'VEST PROTECTED!', '#00FF00');
      return;
    }

    // Camera shake
    cameraSystem.shake(5);

    // Falling rocks
    const rockCount = 8 + Math.floor(Math.random() * 5); // 8-12 rocks
    for (let i = 0; i < rockCount; i++) {
      setTimeout(() => {
        this.createFallingRock(container);
      }, i * 100); // Stagger rocks
    }

    // Dust cloud at player position
    this.createDustCloud(container, playerPos);

    // Banner
    this.showBanner(container, 'CAVE-IN!', '#FF0000');

    // TODO: Sound effect
    console.log('🔊 cave_in SFX');
  }

  /**
   * Create a falling rock particle.
   */
  private static createFallingRock(container: Container): void {
    const rock = new Graphics();
    const size = 6 + Math.random() * 6; // 6-12px
    const color = Math.random() > 0.5 ? 0x8B4513 : 0x654321; // Brown shades

    rock.rect(-size / 2, -size / 2, size, size);
    rock.fill(color);

    // Random starting position near top
    rock.x = Math.random() * container.width;
    rock.y = -20;

    container.addChild(rock);

    let vy = 2 + Math.random() * 3;
    let rotation = 0;
    const rotationSpeed = (Math.random() - 0.5) * 0.3;
    let bounced = false;

    const animate = () => {
      if (!rock.parent) return;

      // Update position
      rock.y += vy;
      vy += 0.3; // Gravity

      // Update rotation
      rotation += rotationSpeed;
      rock.rotation = rotation;

      // Bounce once
      if (!bounced && rock.y > container.height - 50) {
        vy *= -0.4; // Bounce with energy loss
        bounced = true;
      }

      // Remove if off screen
      if (rock.y > container.height + 50 || (bounced && vy > -0.5)) {
        container.removeChild(rock);
        rock.destroy();
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Create dust cloud effect at position.
   */
  private static createDustCloud(container: Container, playerPos: Position): void {
    const centerX = playerPos.x * BLOCK_SIZE + BLOCK_SIZE / 2;
    const centerY = playerPos.y * BLOCK_SIZE + BLOCK_SIZE / 2;

    // 3 expanding circles
    for (let i = 0; i < 3; i++) {
      const cloud = new Graphics();
      container.addChild(cloud);

      let radius = 10 + i * 10;
      const maxRadius = 80 + i * 20;
      let elapsed = 0;
      const duration = 800;

      const animate = () => {
        if (!cloud.parent) return;

        elapsed += 16.67;
        const progress = Math.min(elapsed / duration, 1);

        radius = maxRadius * progress;
        const alpha = (1 - progress) * 0.6;

        cloud.clear();
        cloud.circle(centerX, centerY, radius);
        cloud.fill({ color: 0x888888, alpha });

        if (progress >= 1) {
          container.removeChild(cloud);
          cloud.destroy();
          return;
        }

        requestAnimationFrame(animate);
      };

      animate();
    }
  }

  /**
   * Play gas pocket event effect.
   * Green fog, torch blackout, flickering.
   *
   * @param container - Container to add effects to
   * @param app - PIXI Application
   * @param lightingSystem - Lighting system to control torch
   * @param blocked - Whether event was blocked by torch tier
   */
  static playGasPocket(
    container: Container,
    app: Application,
    lightingSystem: LightingSystem,
    blocked: boolean
  ): void {
    console.log('☠️ GAS POCKET!', blocked ? '(BLOCKED)' : '');

    if (blocked) {
      // Show protection banner
      this.showBanner(container, 'TORCH RESISTS!', '#00FF00');
      return;
    }

    // Green fog overlay
    const fog = new Graphics();
    fog.rect(0, 0, app.screen.width, app.screen.height);
    fog.fill({ color: 0x00FF00, alpha: 0 });
    container.addChild(fog);

    // Fade in fog
    let fogAlpha = 0;
    const fadeIn = setInterval(() => {
      fogAlpha += 0.02;
      fog.alpha = Math.min(fogAlpha, 0.1);
      if (fogAlpha >= 0.1) clearInterval(fadeIn);
    }, 50);

    // Torch blackout
    lightingSystem.setBlackout(true);

    // Banner
    this.showBanner(container, 'GAS POCKET! Torch dimmed!', '#FFFF00');

    // TODO: Sound effect
    console.log('🔊 gas_pocket SFX');

    // Restore after duration
    setTimeout(() => {
      // Fade out fog
      const fadeOut = setInterval(() => {
        fogAlpha -= 0.01;
        fog.alpha = Math.max(fogAlpha, 0);
        if (fogAlpha <= 0) {
          clearInterval(fadeOut);
          container.removeChild(fog);
          fog.destroy();
        }
      }, 50);

      // Restore torch
      lightingSystem.setBlackout(false);
      console.log('💡 Torch restored');
    }, GAS_POCKET_DURATION);
  }

  /**
   * Play underground spring event effect.
   * Blue burst, water droplets, bonus items.
   *
   * @param container - Container to add effects to
   * @param playerPos - Player's position in blocks
   * @param bonusItems - Items that were spawned
   */
  static playUndergroundSpring(
    container: Container,
    playerPos: Position,
    bonusItems: { itemType: ItemType; position: Position }[]
  ): void {
    console.log('💧 UNDERGROUND SPRING!');

    const centerX = playerPos.x * BLOCK_SIZE + BLOCK_SIZE / 2;
    const centerY = playerPos.y * BLOCK_SIZE + BLOCK_SIZE / 2;

    // Blue circle burst
    const burst = new Graphics();
    container.addChild(burst);

    let radius = 0;
    const maxRadius = 100;
    let elapsed = 0;
    const duration = 600;

    const animateBurst = () => {
      if (!burst.parent) return;

      elapsed += 16.67;
      const progress = Math.min(elapsed / duration, 1);

      radius = maxRadius * progress;
      const alpha = (1 - progress) * 0.5;

      burst.clear();
      burst.circle(centerX, centerY, radius);
      burst.fill({ color: 0x0088FF, alpha });

      if (progress >= 1) {
        container.removeChild(burst);
        burst.destroy();
        return;
      }

      requestAnimationFrame(animateBurst);
    };

    animateBurst();

    // Water droplets
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.createWaterDroplet(container, centerX, centerY);
      }, i * 50);
    }

    // Banner
    this.showBanner(container, 'UNDERGROUND SPRING!', '#0088FF');

    // Floating item text
    bonusItems.forEach((item, index) => {
      const itemDef = ITEMS[item.itemType];
      setTimeout(() => {
        this.showFloatingItemText(container, `+1 ${itemDef.name}`, centerX, centerY - 40 - index * 30, '#00FF00');
        console.log('🔊 item_drop SFX');
      }, index * 200);
    });
  }

  /**
   * Create water droplet particle.
   */
  private static createWaterDroplet(container: Container, x: number, y: number): void {
    const droplet = new Graphics();
    droplet.circle(0, 0, 3);
    droplet.fill(0x0088FF);
    droplet.x = x;
    droplet.y = y;
    container.addChild(droplet);

    let vy = -3 - Math.random() * 2; // Launch upward
    const vx = (Math.random() - 0.5) * 2;

    const animate = () => {
      if (!droplet.parent) return;

      droplet.x += vx;
      droplet.y += vy;
      vy += 0.2; // Gravity

      droplet.alpha = Math.max(0, 1 - (droplet.y - y) / 100);

      if (droplet.y > y + 100 || droplet.alpha <= 0) {
        container.removeChild(droplet);
        droplet.destroy();
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Play treasure chest event effect.
   * Golden glow, sparkles, chest emoji, bonus items.
   *
   * @param container - Container to add effects to
   * @param playerPos - Player's position in blocks
   * @param bonusItems - Items that were spawned
   */
  static playTreasureChest(
    container: Container,
    playerPos: Position,
    bonusItems: { itemType: ItemType; position: Position }[]
  ): void {
    console.log('🎁 TREASURE CHEST!');

    const centerX = playerPos.x * BLOCK_SIZE + BLOCK_SIZE / 2;
    const centerY = playerPos.y * BLOCK_SIZE + BLOCK_SIZE / 2;

    // Golden glow
    const glow = new Graphics();
    container.addChild(glow);

    let radius = 0;
    const maxRadius = 120;
    let elapsed = 0;
    const duration = 800;

    const animateGlow = () => {
      if (!glow.parent) return;

      elapsed += 16.67;
      const progress = Math.min(elapsed / duration, 1);

      radius = maxRadius * progress;
      const alpha = (1 - progress) * 0.4;

      glow.clear();
      glow.circle(centerX, centerY, radius);
      glow.fill({ color: 0xFFD700, alpha });

      if (progress >= 1) {
        container.removeChild(glow);
        glow.destroy();
        return;
      }

      requestAnimationFrame(animateGlow);
    };

    animateGlow();

    // Gold sparkles
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        this.createSparkle(container, centerX, centerY);
      }, i * 40);
    }

    // Chest emoji animation
    this.showChestEmoji(container, centerX, centerY);

    // Banner
    this.showBanner(container, 'TREASURE CHEST!', '#FFD700');

    // Floating item text
    bonusItems.forEach((item, index) => {
      const itemDef = ITEMS[item.itemType];
      setTimeout(() => {
        this.showFloatingItemText(container, `+1 ${itemDef.name}`, centerX, centerY - 40 - index * 30, '#FFD700');
        console.log('🔊 rare_find SFX');
      }, index * 200);
    });
  }

  /**
   * Create sparkle particle.
   */
  private static createSparkle(container: Container, centerX: number, centerY: number): void {
    const sparkle = new Graphics();
    sparkle.circle(0, 0, 2);
    sparkle.fill(0xFFFF00);

    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 40;
    sparkle.x = centerX + Math.cos(angle) * distance;
    sparkle.y = centerY + Math.sin(angle) * distance;

    container.addChild(sparkle);

    let elapsed = 0;
    const duration = 500;

    const animate = () => {
      if (!sparkle.parent) return;

      elapsed += 16.67;
      const progress = elapsed / duration;

      sparkle.alpha = 1 - progress;
      sparkle.scale.set(1 - progress * 0.5);

      if (progress >= 1) {
        container.removeChild(sparkle);
        sparkle.destroy();
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Show chest emoji animation.
   */
  private static showChestEmoji(container: Container, x: number, y: number): void {
    const emojiStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 48
    });

    const emoji = new Text({ text: '🎁', style: emojiStyle });
    emoji.anchor.set(0.5);
    emoji.x = x;
    emoji.y = y;
    emoji.scale.set(0);
    container.addChild(emoji);

    let elapsed = 0;
    const duration = 600;

    const animate = () => {
      if (!emoji.parent) return;

      elapsed += 16.67;
      const progress = elapsed / duration;

      // Scale up then back down
      if (progress < 0.5) {
        emoji.scale.set(progress * 4); // 0 to 2
      } else {
        emoji.scale.set(2 - (progress - 0.5) * 4); // 2 to 0
      }

      if (progress >= 1) {
        container.removeChild(emoji);
        emoji.destroy();
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Play rock slide event effect.
   * Camera shake, brown tint, blocks are hardened.
   *
   * @param container - Container to add effects to
   * @param app - PIXI Application
   * @param cameraSystem - Camera system for shake effect
   * @param blocked - Whether event was blocked by helmet
   */
  static playRockSlide(
    container: Container,
    app: Application,
    cameraSystem: CameraSystem,
    blocked: boolean
  ): void {
    console.log('🪨 ROCK SLIDE!', blocked ? '(BLOCKED)' : '');

    if (blocked) {
      // Show protection banner
      this.showBanner(container, 'HELMET DEFLECTS!', '#00FF00');
      return;
    }

    // Camera shake (lighter than cave-in)
    cameraSystem.shake(3);

    // Brown screen tint
    const tint = new Graphics();
    tint.rect(0, 0, app.screen.width, app.screen.height);
    tint.fill({ color: 0x8B4513, alpha: 0.15 });
    container.addChild(tint);

    // Fade out tint
    let elapsed = 0;
    const duration = 400;

    const animate = () => {
      if (!tint.parent) return;

      elapsed += 16.67;
      const progress = elapsed / duration;

      tint.alpha = 0.15 * (1 - progress);

      if (progress >= 1) {
        container.removeChild(tint);
        tint.destroy();
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();

    // Banner
    this.showBanner(container, 'ROCK SLIDE! Blocks hardened!', '#FF8800');

    // TODO: Sound effect (quieter cave_in)
    console.log('🔊 cave_in (quiet) SFX');
  }

  /**
   * Show centered banner with fade animation.
   *
   * @param container - Container to add banner to
   * @param text - Banner text
   * @param color - Text color
   */
  private static showBanner(container: Container, text: string, color: string): void {
    const bannerStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: color,
      stroke: { color: '#000000', width: 4 }
    });

    const banner = new Text({ text, style: bannerStyle });
    banner.anchor.set(0.5);
    banner.x = container.width / 2;
    banner.y = container.height / 2 - 100;
    banner.alpha = 0;
    container.addChild(banner);

    let phase = 0; // 0: fade in, 1: hold, 2: fade out
    let elapsed = 0;
    const fadeInDuration = 200;
    const holdDuration = 1000;
    const fadeOutDuration = 500;

    const animate = () => {
      if (!banner.parent) return;

      elapsed += 16.67;

      if (phase === 0) {
        // Fade in
        const progress = Math.min(elapsed / fadeInDuration, 1);
        banner.alpha = progress;
        if (progress >= 1) {
          phase = 1;
          elapsed = 0;
        }
      } else if (phase === 1) {
        // Hold
        if (elapsed >= holdDuration) {
          phase = 2;
          elapsed = 0;
        }
      } else if (phase === 2) {
        // Fade out
        const progress = elapsed / fadeOutDuration;
        banner.alpha = 1 - progress;
        if (progress >= 1) {
          container.removeChild(banner);
          banner.destroy();
          return;
        }
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Show floating item text.
   *
   * @param container - Container to add text to
   * @param text - Text to show
   * @param x - X position
   * @param y - Y position
   * @param color - Text color
   */
  private static showFloatingItemText(
    container: Container,
    text: string,
    x: number,
    y: number,
    color: string
  ): void {
    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: color,
      stroke: { color: '#000000', width: 3 }
    });

    const floatingText = new Text({ text, style: textStyle });
    floatingText.anchor.set(0.5);
    floatingText.x = x;
    floatingText.y = y;
    container.addChild(floatingText);

    let elapsed = 0;
    const duration = 1500;

    const animate = () => {
      if (!floatingText.parent) return;

      elapsed += 16.67;
      const progress = elapsed / duration;

      floatingText.y -= 1; // Float upward
      floatingText.alpha = 1 - progress;

      if (progress >= 1) {
        container.removeChild(floatingText);
        floatingText.destroy();
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }
}
