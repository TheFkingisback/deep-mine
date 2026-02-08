import { Container, Graphics } from 'pixi.js';
import { Position } from '@shared/types';

/**
 * Single particle data.
 */
interface Particle {
  graphics: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  lifetime: number;
  elapsed: number;
  size: number;
  color: number;
  alphaStart: number;
  alphaEnd: number;
  sizeEnd: number;
  rotation: number;
  rotationSpeed: number;
  bounce: boolean;
}

/**
 * Particle emitter configuration.
 */
export interface EmitterConfig {
  position: Position;
  count: number;
  colors: number[];
  speedMin: number;
  speedMax: number;
  angleMin: number;
  angleMax: number;
  gravity: number;
  lifetimeMin: number;
  lifetimeMax: number;
  sizeMin: number;
  sizeMax: number;
  sizeEnd?: number;
  alphaStart: number;
  alphaEnd: number;
  rotationSpeedMin?: number;
  rotationSpeedMax?: number;
  bounce?: boolean;
}

/**
 * Generic, reusable particle system for visual effects.
 * Supports object pooling for performance.
 */
export class ParticleSystem {
  private container: Container;
  private particles: Particle[] = [];
  private pool: Particle[] = [];
  private maxParticles = 500;

  constructor(stage: Container) {
    this.container = new Container();
    stage.addChild(this.container);
  }

  /**
   * Emit particles with the given configuration.
   */
  emit(config: EmitterConfig): void {
    for (let i = 0; i < config.count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const particle = this.getParticle();

      // Random color from palette
      particle.color = config.colors[Math.floor(Math.random() * config.colors.length)];

      // Position
      particle.x = config.position.x;
      particle.y = config.position.y;

      // Velocity (random angle and speed)
      const angle = config.angleMin + Math.random() * (config.angleMax - config.angleMin);
      const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;

      // Physics
      particle.gravity = config.gravity;
      particle.bounce = config.bounce ?? false;

      // Lifetime
      particle.lifetime = config.lifetimeMin + Math.random() * (config.lifetimeMax - config.lifetimeMin);
      particle.elapsed = 0;

      // Appearance
      particle.size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
      particle.sizeEnd = config.sizeEnd ?? particle.size;
      particle.alphaStart = config.alphaStart;
      particle.alphaEnd = config.alphaEnd;

      // Rotation
      particle.rotation = Math.random() * Math.PI * 2;
      particle.rotationSpeed = config.rotationSpeedMin !== undefined
        ? config.rotationSpeedMin + Math.random() * ((config.rotationSpeedMax ?? 0) - config.rotationSpeedMin)
        : 0;

      // Render
      this.renderParticle(particle);
      this.particles.push(particle);
    }
  }

  /**
   * Update all active particles.
   */
  update(deltaMs: number): void {
    const deltaSec = deltaMs / 1000;
    const toRemove: number[] = [];

    this.particles.forEach((particle, index) => {
      // Update lifetime
      particle.elapsed += deltaMs;
      if (particle.elapsed >= particle.lifetime) {
        toRemove.push(index);
        return;
      }

      // Update physics
      particle.vy += particle.gravity * deltaSec;
      particle.x += particle.vx * deltaSec;
      particle.y += particle.vy * deltaSec;

      // Update rotation
      particle.rotation += particle.rotationSpeed * deltaSec;

      // Update appearance (interpolation)
      const progress = particle.elapsed / particle.lifetime;
      const currentSize = particle.size + (particle.sizeEnd - particle.size) * progress;
      const currentAlpha = particle.alphaStart + (particle.alphaEnd - particle.alphaStart) * progress;

      // Re-render
      particle.graphics.clear();
      particle.graphics.circle(0, 0, currentSize);
      particle.graphics.fill({ color: particle.color, alpha: currentAlpha });
      particle.graphics.x = particle.x;
      particle.graphics.y = particle.y;
      particle.graphics.rotation = particle.rotation;
    });

    // Remove dead particles (reverse order to avoid index issues)
    toRemove.reverse().forEach(index => {
      this.recycleParticle(this.particles[index]);
      this.particles.splice(index, 1);
    });
  }

  /**
   * Get a particle from the pool or create a new one.
   */
  private getParticle(): Particle {
    if (this.pool.length > 0) {
      const particle = this.pool.pop()!;
      particle.graphics.visible = true;
      return particle;
    }

    const graphics = new Graphics();
    this.container.addChild(graphics);

    return {
      graphics,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      gravity: 0,
      lifetime: 0,
      elapsed: 0,
      size: 0,
      color: 0xFFFFFF,
      alphaStart: 1,
      alphaEnd: 0,
      sizeEnd: 0,
      rotation: 0,
      rotationSpeed: 0,
      bounce: false
    };
  }

  /**
   * Recycle a particle back to the pool.
   */
  private recycleParticle(particle: Particle): void {
    particle.graphics.visible = false;
    this.pool.push(particle);
  }

  /**
   * Render a particle's initial state.
   */
  private renderParticle(particle: Particle): void {
    particle.graphics.clear();
    particle.graphics.circle(0, 0, particle.size);
    particle.graphics.fill({ color: particle.color, alpha: particle.alphaStart });
    particle.graphics.x = particle.x;
    particle.graphics.y = particle.y;
    particle.graphics.rotation = particle.rotation;
  }

  /**
   * Clean up all particles.
   */
  destroy(): void {
    this.particles.forEach(p => p.graphics.destroy());
    this.pool.forEach(p => p.graphics.destroy());
    this.particles = [];
    this.pool = [];
    this.container.destroy({ children: true });
  }

  // ===== PRE-CONFIGURED EMITTER PRESETS =====

  /**
   * Burst of particles when digging a block.
   */
  static DIG_BURST(position: Position, color: number): EmitterConfig {
    return {
      position,
      count: 8 + Math.floor(Math.random() * 5), // 8-12 particles
      colors: [color],
      speedMin: 50,
      speedMax: 150,
      angleMin: 0,
      angleMax: Math.PI * 2,
      gravity: 200,
      lifetimeMin: 400,
      lifetimeMax: 600,
      sizeMin: 3,
      sizeMax: 6,
      alphaStart: 1.0,
      alphaEnd: 0.0
    };
  }

  /**
   * Explosion particles (TNT, etc).
   */
  static EXPLOSION(position: Position): EmitterConfig {
    const colors = [0xFF4500, 0xFF6347, 0xFFD700, 0xFF8C00]; // Orange, red, yellow mix
    return {
      position,
      count: 20 + Math.floor(Math.random() * 11), // 20-30 particles
      colors,
      speedMin: 100,
      speedMax: 300,
      angleMin: 0,
      angleMax: Math.PI * 2,
      gravity: 100,
      lifetimeMin: 600,
      lifetimeMax: 1000,
      sizeMin: 4,
      sizeMax: 10,
      alphaStart: 1.0,
      alphaEnd: 0.0,
      bounce: true
    };
  }

  /**
   * Sparkle effect for rare items.
   */
  static RARE_ITEM_SPARKLE(position: Position): EmitterConfig {
    return {
      position,
      count: 12 + Math.floor(Math.random() * 5), // 12-16 particles
      colors: [0xFFD700], // Gold
      speedMin: 80,
      speedMax: 150,
      angleMin: 0,
      angleMax: Math.PI * 2,
      gravity: 0, // No gravity - expand outward
      lifetimeMin: 800,
      lifetimeMax: 800,
      sizeMin: 2,
      sizeMax: 4,
      alphaStart: 1.0,
      alphaEnd: 0.0,
      rotationSpeedMin: -Math.PI,
      rotationSpeedMax: Math.PI
    };
  }

  /**
   * Coin fountain arc (for selling items).
   */
  static COIN_FOUNTAIN(startPos: Position, endPos: Position): EmitterConfig {
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const angle = Math.atan2(dy, dx);
    const spread = Math.PI / 6; // 30 degree spread

    return {
      position: startPos,
      count: 5 + Math.floor(Math.random() * 4), // 5-8 particles
      colors: [0xFFD700], // Gold
      speedMin: 150,
      speedMax: 200,
      angleMin: angle - spread / 2,
      angleMax: angle + spread / 2,
      gravity: 300,
      lifetimeMin: 600,
      lifetimeMax: 600,
      sizeMin: 4,
      sizeMax: 6,
      alphaStart: 1.0,
      alphaEnd: 1.0 // Stay visible
    };
  }

  /**
   * Orbiting stun stars (continuous effect).
   * Note: This would need a separate system for continuous effects.
   * For now, this emits a burst that looks like orbiting stars.
   */
  static STUN_STARS(position: Position): EmitterConfig {
    return {
      position,
      count: 3,
      colors: [0xFFFF00], // Yellow
      speedMin: 0,
      speedMax: 0,
      angleMin: 0,
      angleMax: 0,
      gravity: 0,
      lifetimeMin: 1000,
      lifetimeMax: 1000,
      sizeMin: 6,
      sizeMax: 8,
      alphaStart: 1.0,
      alphaEnd: 1.0,
      rotationSpeedMin: Math.PI * 2, // 360°/sec
      rotationSpeedMax: Math.PI * 2
    };
  }
}
