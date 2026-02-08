import { Application, Container, Graphics, Ticker } from 'pixi.js';

/**
 * LightingSystem creates torch-based radial lighting around the player.
 * Uses a dark overlay with a soft gradient "hole" for visibility.
 */
export class LightingSystem {
  private app: Application;
  private container: Container;
  private overlay: Graphics;
  private lightMask: Graphics;

  // Lighting parameters
  private torchRadius = 5; // In blocks
  private readonly blockSize = 40; // Pixels per block
  private playerScreenX = 0;
  private playerScreenY = 0;

  // Emergency mode (for Gas Pocket event)
  private emergencyMode = false;
  private emergencyTimer = 0;
  private emergencyFlickerSpeed = 200; // ms per flicker

  // Animation state
  private currentRadius = 0;
  private targetRadius = 0;
  private radiusTransitionSpeed = 0.1;

  constructor(app: Application) {
    this.app = app;
    this.container = new Container();

    // Create light mask (radial gradient) - drawn FIRST
    this.lightMask = new Graphics();
    this.container.addChild(this.lightMask);

    // Create overlay (dark layer) - drawn SECOND (on top)
    this.overlay = new Graphics();
    this.overlay.blendMode = 'multiply'; // Blend mode for darkening
    this.container.addChild(this.overlay);

    // Add to stage (should be above game elements but below UI)
    this.app.stage.addChild(this.container);

    // Initial setup
    this.targetRadius = this.torchRadius * this.blockSize;
    this.currentRadius = this.targetRadius;
    this.updateOverlay();
    this.updateLightMask();
  }

  /**
   * Set the torch radius in blocks.
   *
   * @param radius - Torch radius in blocks
   */
  setTorchRadius(radius: number): void {
    this.torchRadius = radius;
    this.targetRadius = radius * this.blockSize;
  }

  /**
   * Update the light position to follow the player.
   *
   * @param screenX - Player's screen X coordinate
   * @param screenY - Player's screen Y coordinate
   */
  updatePosition(screenX: number, screenY: number): void {
    this.playerScreenX = screenX;
    this.playerScreenY = screenY;
    this.updateLightMask();
  }

  /**
   * Set emergency mode (Gas Pocket event).
   * Shrinks radius to 1 block with flickering.
   *
   * @param active - Whether emergency mode is active
   */
  setEmergencyMode(active: boolean): void {
    this.emergencyMode = active;

    if (active) {
      // Shrink to minimum radius
      this.targetRadius = 1 * this.blockSize;
    } else {
      // Restore normal radius
      this.targetRadius = this.torchRadius * this.blockSize;
    }

    this.emergencyTimer = 0;
  }

  /**
   * Set blackout mode (alias for setEmergencyMode).
   * Used by gas pocket events to temporarily disable/dim torch.
   *
   * @param active - Whether blackout mode is active
   */
  setBlackout(active: boolean): void {
    this.setEmergencyMode(active);
  }

  /**
   * Update the full-screen dark overlay.
   */
  private updateOverlay(): void {
    this.overlay.clear();

    // TEMPORARY: Disable overlay to see if blocks render
    // Full-screen black overlay with slight transparency
    this.overlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
    this.overlay.fill({ color: 0x000000, alpha: 0.0 }); // Set to 0 temporarily

    // Set overlay to cover entire screen
    this.overlay.x = 0;
    this.overlay.y = 0;
  }

  /**
   * Update the light mask with radial gradient.
   */
  private updateLightMask(): void {
    this.lightMask.clear();

    // TEMPORARY: Disable light mask completely to debug
    // The issue is that the mask is covering everything
    // We'll fix this properly later with correct masking

    // For now, just don't draw anything in the light mask
    return;
  }

  /**
   * Get warm torch color based on distance from center.
   * Returns a color that transitions from warm orange (center) to neutral (edge).
   *
   * @param intensity - 0 (edge) to 1 (center)
   * @returns Color value
   */
  private getWarmTorchColor(intensity: number): number {
    // At center: warm orange (#FF9944)
    // At edge: neutral dark (#111111)

    const centerR = 0xFF;
    const centerG = 0x99;
    const centerB = 0x44;

    const edgeR = 0x11;
    const edgeG = 0x11;
    const edgeB = 0x11;

    const r = Math.floor(edgeR + (centerR - edgeR) * intensity);
    const g = Math.floor(edgeG + (centerG - edgeG) * intensity);
    const b = Math.floor(edgeB + (centerB - edgeB) * intensity);

    return (r << 16) | (g << 8) | b;
  }

  /**
   * Update the lighting system (called every frame).
   * Handles smooth radius transitions and emergency mode flickering.
   *
   * @param delta - Time delta from ticker
   */
  update(delta: number): void {
    // Update emergency timer
    if (this.emergencyMode) {
      this.emergencyTimer += delta * 16; // Convert to ms (assuming 60fps)
    }

    // Smooth radius transition
    const radiusDiff = this.targetRadius - this.currentRadius;
    if (Math.abs(radiusDiff) > 0.5) {
      this.currentRadius += radiusDiff * this.radiusTransitionSpeed;
      this.updateLightMask();
    }

    // Update flicker in emergency mode
    if (this.emergencyMode) {
      this.updateLightMask();
    }

    // Update overlay size if screen resized
    if (this.overlay.width !== this.app.screen.width || this.overlay.height !== this.app.screen.height) {
      this.updateOverlay();
      this.updateLightMask();
    }
  }

  /**
   * Resize handler for when window size changes.
   */
  resize(width: number, height: number): void {
    this.updateOverlay();
    this.updateLightMask();
  }

  /**
   * Get the current effective torch radius in blocks.
   */
  getCurrentRadius(): number {
    return this.currentRadius / this.blockSize;
  }

  /**
   * Check if a position is within the lit area.
   *
   * @param x - X coordinate in pixels
   * @param y - Y coordinate in pixels
   * @returns True if position is lit
   */
  isPositionLit(x: number, y: number): boolean {
    const dx = x - this.playerScreenX;
    const dy = y - this.playerScreenY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.currentRadius;
  }

  /**
   * Get the light intensity at a position (0 = dark, 1 = fully lit).
   *
   * @param x - X coordinate in pixels
   * @param y - Y coordinate in pixels
   * @returns Light intensity 0-1
   */
  getLightIntensity(x: number, y: number): number {
    const dx = x - this.playerScreenX;
    const dy = y - this.playerScreenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= this.currentRadius * 0.7) {
      // Inner zone: fully lit
      return 1;
    } else if (distance <= this.currentRadius) {
      // Transition zone: gradient
      const transitionT = (distance - this.currentRadius * 0.7) / (this.currentRadius * 0.3);
      return 1 - transitionT;
    } else {
      // Outer zone: dark
      return 0;
    }
  }

  /**
   * Clean up the lighting system.
   */
  destroy(): void {
    this.overlay.destroy();
    this.lightMask.destroy();
    this.container.destroy({ children: true });
  }
}
