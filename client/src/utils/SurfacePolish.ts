import { Graphics } from 'pixi.js';

/**
 * Visual polish effects for the Surface scene.
 */
export class SurfacePolish {
  /**
   * Animate sun glow pulsing effect (±5px over 4 seconds).
   * @param sun - Sun graphics object
   * @param startTime - Animation start time
   */
  static updateSunGlow(sun: Graphics, startTime: number): void {
    const elapsed = (Date.now() - startTime) / 1000;
    const pulsePhase = elapsed % 4; // 4 second cycle
    const pulseProgress = pulsePhase / 4;

    // Sine wave for smooth pulsing
    const pulse = Math.sin(pulseProgress * Math.PI * 2) * 5;

    // Update sun scale
    const baseScale = 1.0;
    const scale = baseScale + (pulse / 100); // Small scale change
    sun.scale.set(scale);
  }

  /**
   * Create parallax cloud layer data.
   * @param screenWidth - Screen width
   * @param count - Number of clouds
   * @param layer - Layer number (1-3, higher = slower)
   * @returns Array of cloud data
   */
  static createParallaxClouds(
    screenWidth: number,
    count: number,
    layer: number
  ): Array<{ x: number; y: number; speed: number; size: number }> {
    const clouds: Array<{ x: number; y: number; speed: number; size: number }> = [];
    const baseSpeed = 10 / layer; // Slower for higher layers (parallax effect)

    for (let i = 0; i < count; i++) {
      clouds.push({
        x: Math.random() * screenWidth,
        y: 50 + Math.random() * 100 + (layer * 30), // Stagger heights by layer
        speed: baseSpeed + Math.random() * 5,
        size: 60 + Math.random() * 40 - (layer * 10) // Smaller for distant layers
      });
    }

    return clouds;
  }

  /**
   * Update cloud positions with parallax scrolling.
   * @param clouds - Array of cloud data
   * @param deltaMs - Time delta in milliseconds
   * @param screenWidth - Screen width for wrapping
   */
  static updateParallaxClouds(
    clouds: Array<{ x: number; y: number; speed: number; size: number }>,
    deltaMs: number,
    screenWidth: number
  ): void {
    const deltaSec = deltaMs / 1000;

    clouds.forEach(cloud => {
      cloud.x += cloud.speed * deltaSec;

      // Wrap around
      if (cloud.x > screenWidth + cloud.size) {
        cloud.x = -cloud.size;
      }
    });
  }

  /**
   * Calculate grass sway offset using sine wave.
   * @param time - Current time in seconds
   * @param x - X position of grass blade (for variation)
   * @returns Y offset for grass sway
   */
  static calculateGrassSway(time: number, x: number): number {
    const frequency = 2; // Sway frequency
    const amplitude = 3; // Max sway amount in pixels
    const phase = x * 0.1; // Phase shift based on position

    return Math.sin(time * frequency + phase) * amplitude;
  }

  /**
   * Animate lantern flicker (alpha 0.5-0.8 random).
   * @param lantern - Lantern graphics object
   */
  static updateLanternFlicker(lantern: Graphics): void {
    // Random flicker with some smoothing
    const targetAlpha = 0.5 + Math.random() * 0.3;
    const currentAlpha = lantern.alpha;

    // Smooth transition to target alpha
    lantern.alpha = currentAlpha + (targetAlpha - currentAlpha) * 0.1;
  }

  /**
   * Create multiple parallax layers of clouds.
   * @param screenWidth - Screen width
   * @returns Object with three cloud layers
   */
  static createAllCloudLayers(screenWidth: number): {
    layer1: Array<{ x: number; y: number; speed: number; size: number }>;
    layer2: Array<{ x: number; y: number; speed: number; size: number }>;
    layer3: Array<{ x: number; y: number; speed: number; size: number }>;
  } {
    return {
      layer1: this.createParallaxClouds(screenWidth, 3, 1), // Closest, fastest
      layer2: this.createParallaxClouds(screenWidth, 3, 2), // Middle
      layer3: this.createParallaxClouds(screenWidth, 2, 3)  // Furthest, slowest
    };
  }
}
