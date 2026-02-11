import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Position } from '@shared/types';
import { BLOCK_SIZE } from '@shared/constants';

/**
 * Particle for explosion debris animation.
 */
interface DebrisParticle {
  graphics: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  lifetime: number;
  elapsed: number;
  bounced: boolean;
}

/**
 * Smoke ring for explosion effect.
 */
interface SmokeRing {
  graphics: Graphics;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  lifetime: number;
  elapsed: number;
}

/**
 * ExplosionEffect handles all visual effects for TNT explosions.
 * Includes fireball, smoke rings, debris particles, camera shake, and screen flash.
 */
export class ExplosionEffect {
  /**
   * Play a complete TNT explosion effect at a given world position.
   *
   * @param centerBlock - Block position where TNT exploded
   * @param app - PIXI Application
   * @param container - Container to add explosion graphics to
   * @param cameraShakeCallback - Callback to trigger camera shake
   * @param onComplete - Called when explosion animation completes
   */
  static play(
    centerBlock: Position,
    app: Application,
    container: Container,
    cameraShakeCallback: (intensity: number, duration: number) => void,
    onComplete: () => void
  ): void {
    // Convert block position to screen coordinates
    const centerX = centerBlock.x * BLOCK_SIZE + BLOCK_SIZE / 2;
    const centerY = centerBlock.y * BLOCK_SIZE + BLOCK_SIZE / 2;

    // Create explosion container
    const explosionContainer = new Container();
    container.addChild(explosionContainer);

    // Screen flash
    this.createScreenFlash(app, container);

    // Fireball
    this.createFireball(centerX, centerY, explosionContainer);

    // Smoke rings
    const smokeRings = this.createSmokeRings(centerX, centerY, explosionContainer);

    // Debris particles
    const debrisParticles = this.createDebrisParticles(centerX, centerY, explosionContainer);

    // Camera shake
    cameraShakeCallback(5, 500);

    // Animation loop
    let elapsed = 0;
    const totalDuration = 800;

    const tickerCallback = (delta: { deltaTime: number }) => {
      const deltaMs = delta.deltaTime * 16.67;
      elapsed += deltaMs;

      // Update smoke rings
      this.updateSmokeRings(smokeRings, deltaMs);

      // Update debris particles
      this.updateDebrisParticles(debrisParticles, deltaMs);

      // Complete animation
      if (elapsed >= totalDuration) {
        app.ticker.remove(tickerCallback);
        container.removeChild(explosionContainer);
        explosionContainer.destroy({ children: true });
        onComplete();
      }
    };
    app.ticker.add(tickerCallback);
  }

  /**
   * Create screen flash overlay.
   */
  private static createScreenFlash(app: Application, container: Container): void {
    const flash = new Graphics();
    flash.rect(0, 0, app.screen.width, app.screen.height);
    flash.fill({ color: 0xFFFFFF, alpha: 0.3 });
    container.addChild(flash);

    // Remove after 50ms
    setTimeout(() => {
      container.removeChild(flash);
      flash.destroy();
    }, 50);
  }

  /**
   * Create expanding fireball with gradient.
   */
  private static createFireball(x: number, y: number, container: Container): void {
    const fireball = new Graphics();
    container.addChild(fireball);

    let radius = 0;
    const maxRadius = 120;
    const duration = 300;
    let elapsed = 0;

    const animate = () => {
      if (elapsed >= duration) {
        container.removeChild(fireball);
        fireball.destroy();
        return;
      }

      elapsed += 16.67;
      const progress = elapsed / duration;
      radius = maxRadius * progress;

      fireball.clear();

      // Draw gradient circles from center outward
      // White center
      fireball.circle(x, y, radius * 0.3);
      fireball.fill({ color: 0xFFFFFF, alpha: 1 - progress * 0.5 });

      // Orange middle
      fireball.circle(x, y, radius * 0.6);
      fireball.fill({ color: 0xFF8800, alpha: (1 - progress) * 0.8 });

      // Dark red edge
      fireball.circle(x, y, radius);
      fireball.fill({ color: 0xCC0000, alpha: (1 - progress) * 0.6 });

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Create three smoke rings expanding outward.
   */
  private static createSmokeRings(x: number, y: number, container: Container): SmokeRing[] {
    const rings: SmokeRing[] = [];

    for (let i = 0; i < 3; i++) {
      const ring = new Graphics();
      container.addChild(ring);

      rings.push({
        graphics: ring,
        x,
        y,
        radius: 20 + i * 10,
        maxRadius: 150 + i * 20,
        lifetime: 600,
        elapsed: i * 100 // Stagger start
      });
    }

    return rings;
  }

  /**
   * Update smoke rings animation.
   */
  private static updateSmokeRings(rings: SmokeRing[], deltaMs: number): void {
    rings.forEach((ring) => {
      ring.elapsed += deltaMs;

      const progress = Math.min(ring.elapsed / ring.lifetime, 1);
      ring.radius = ring.maxRadius * progress;

      const alpha = (1 - progress) * 0.8;

      ring.graphics.clear();
      ring.graphics.circle(ring.x, ring.y, ring.radius);
      ring.graphics.stroke({ color: 0x888888, width: 3, alpha });
    });
  }

  /**
   * Create debris particles.
   */
  private static createDebrisParticles(x: number, y: number, container: Container): DebrisParticle[] {
    const particles: DebrisParticle[] = [];
    const count = 20;

    for (let i = 0; i < count; i++) {
      const debris = new Graphics();
      const size = 4 + Math.random() * 6;
      const color = Math.random() > 0.5 ? 0x8B4513 : 0x696969; // Brown or gray

      debris.rect(-size / 2, -size / 2, size, size);
      debris.fill(color);
      container.addChild(debris);

      // Random angle outward
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;

      particles.push({
        graphics: debris,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // Bias upward
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        lifetime: 800,
        elapsed: 0,
        bounced: false
      });
    }

    return particles;
  }

  /**
   * Update debris particles with physics.
   */
  private static updateDebrisParticles(particles: DebrisParticle[], deltaMs: number): void {
    particles.forEach((particle) => {
      particle.elapsed += deltaMs;

      // Update position
      particle.x += particle.vx * deltaMs / 16;
      particle.y += particle.vy * deltaMs / 16;

      // Apply gravity
      particle.vy += 0.2;

      // Update rotation
      particle.rotation += particle.rotationSpeed;

      // Simple bounce off "ground" (only once)
      if (!particle.bounced && particle.vy > 0 && particle.y > particle.graphics.y + 100) {
        particle.vy *= -0.5; // Bounce with energy loss
        particle.vx *= 0.7; // Friction
        particle.bounced = true;
      }

      // Apply to graphics
      particle.graphics.x = particle.x;
      particle.graphics.y = particle.y;
      particle.graphics.rotation = particle.rotation;

      // Fade out
      const progress = particle.elapsed / particle.lifetime;
      particle.graphics.alpha = 1 - progress;
    });
  }

  /**
   * Create a fuse spark animation traveling from top to center of a TNT block.
   *
   * @param blockPosition - Position of the TNT block
   * @param container - Container to add fuse graphics to
   * @param onComplete - Called when fuse animation completes (0.3s)
   */
  static playFuse(
    blockPosition: Position,
    container: Container,
    onComplete: () => void
  ): void {
    const blockX = blockPosition.x * BLOCK_SIZE;
    const blockY = blockPosition.y * BLOCK_SIZE;

    const fuse = new Graphics();
    container.addChild(fuse);

    let elapsed = 0;
    const duration = 300; // 0.3 seconds

    const animate = () => {
      if (elapsed >= duration) {
        container.removeChild(fuse);
        fuse.destroy();
        onComplete();
        return;
      }

      elapsed += 16.67;
      const progress = elapsed / duration;

      // Spark position: from top of block to center
      const startY = blockY;
      const endY = blockY + BLOCK_SIZE / 2;
      const currentY = startY + (endY - startY) * progress;
      const centerX = blockX + BLOCK_SIZE / 2;

      fuse.clear();

      // Draw fuse line
      fuse.moveTo(centerX, startY);
      fuse.lineTo(centerX, currentY);
      fuse.stroke({ color: 0xFFFF00, width: 2 });

      // Draw spark at current position
      fuse.circle(centerX, currentY, 3 + Math.sin(elapsed * 0.3) * 2);
      fuse.fill({ color: 0xFFFF00, alpha: 0.8 });

      requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Show floating text for gold penalty.
   *
   * @param text - Text to display (e.g., "-200 G")
   * @param x - Screen X position
   * @param y - Screen Y position
   * @param container - Container to add text to
   * @param offsetY - Y offset for stacking multiple penalties
   */
  static showGoldPenalty(
    text: string,
    x: number,
    y: number,
    container: Container,
    offsetY: number = 0
  ): void {
    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#FF0000',
      stroke: { color: '#000000', width: 4 }
    });

    const floatingText = new Text({ text, style: textStyle });
    floatingText.anchor.set(0.5);
    floatingText.x = x;
    floatingText.y = y - offsetY;
    container.addChild(floatingText);

    let elapsed = 0;
    const duration = 1500;

    const animate = () => {
      if (elapsed >= duration) {
        container.removeChild(floatingText);
        floatingText.destroy();
        return;
      }

      elapsed += 16.67;
      floatingText.y -= 1; // Float upward
      floatingText.alpha = 1 - (elapsed / duration);

      requestAnimationFrame(animate);
    };

    animate();
  }
}
