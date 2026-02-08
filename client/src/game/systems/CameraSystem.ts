import { BLOCK_SIZE } from '@shared/constants';

/**
 * CameraSystem handles smooth camera movement, screen shake effects,
 * and coordinate conversions between world, screen, and block space.
 */
export class CameraSystem {
  // Camera position (in world pixels)
  private x = 0;
  private y = 0;

  // Target position to follow (in world pixels)
  private targetX = 0;
  private targetY = 0;

  // Screen dimensions
  private screenWidth: number;
  private screenHeight: number;

  // Smoothing
  private lerpFactor = 0.1;

  // Screen shake
  private shakeIntensity = 0;
  private readonly shakeDecay = 0.9;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;
  private shakeTime = 0;

  constructor(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  /**
   * Set the world position the camera should follow.
   * Usually this is the player's position in world pixels.
   *
   * @param worldX - Target X position in world pixels
   * @param worldY - Target Y position in world pixels
   */
  setTarget(worldX: number, worldY: number): void {
    this.targetX = worldX;
    this.targetY = worldY;
  }

  /**
   * Update camera position with smooth lerping and shake effects.
   *
   * @param deltaMs - Time elapsed since last update in milliseconds
   */
  update(deltaMs: number): void {
    // Smooth lerp to target
    this.x += (this.targetX - this.x) * this.lerpFactor;
    this.y += (this.targetY - this.y) * this.lerpFactor;

    // Handle screen shake with smooth noise
    if (this.shakeIntensity > 0.5) {
      this.shakeTime += deltaMs / 1000;

      // Smooth organic shake using sine waves
      this.shakeOffsetX = Math.sin(this.shakeTime * 23.1) * this.shakeIntensity * Math.cos(this.shakeTime * 17.3);
      this.shakeOffsetY = Math.sin(this.shakeTime * 19.7) * this.shakeIntensity * Math.cos(this.shakeTime * 21.5);

      // Decay shake intensity
      this.shakeIntensity *= this.shakeDecay;
    } else {
      // Reset shake when intensity is low
      this.shakeIntensity = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeTime = 0;
    }
  }

  /**
   * Trigger a screen shake effect.
   *
   * @param intensity - Shake intensity (5-8 for TNT, 3 for cave-in)
   */
  shake(intensity: number): void {
    this.shakeIntensity = intensity;
  }

  /**
   * Get the offset to apply to the game world container.
   * This centers the camera on the target with shake applied.
   *
   * @returns Offset in pixels { x, y }
   */
  getOffset(): { x: number; y: number } {
    return {
      x: this.screenWidth / 2 - this.x + this.shakeOffsetX,
      y: this.screenHeight / 2 - this.y + this.shakeOffsetY
    };
  }

  /**
   * Convert world pixel coordinates to screen coordinates.
   *
   * @param worldX - World X position in pixels
   * @param worldY - World Y position in pixels
   * @returns Screen coordinates { x, y }
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const offset = this.getOffset();
    return {
      x: worldX + offset.x,
      y: worldY + offset.y
    };
  }

  /**
   * Convert screen coordinates to world pixel coordinates.
   * Used for click-to-block detection.
   *
   * @param screenX - Screen X position in pixels
   * @param screenY - Screen Y position in pixels
   * @returns World coordinates { x, y }
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const offset = this.getOffset();
    return {
      x: screenX - offset.x,
      y: screenY - offset.y
    };
  }

  /**
   * Convert screen coordinates to block grid coordinates.
   *
   * @param screenX - Screen X position in pixels
   * @param screenY - Screen Y position in pixels
   * @returns Block coordinates { x, y }
   */
  screenToBlock(screenX: number, screenY: number): { x: number; y: number } {
    const world = this.screenToWorld(screenX, screenY);
    return {
      x: Math.floor(world.x / BLOCK_SIZE),
      y: Math.floor(world.y / BLOCK_SIZE)
    };
  }

  /**
   * Convert block coordinates to world pixel coordinates.
   *
   * @param blockX - Block X coordinate
   * @param blockY - Block Y coordinate
   * @returns World pixel coordinates { x, y }
   */
  blockToWorld(blockX: number, blockY: number): { x: number; y: number } {
    return {
      x: blockX * BLOCK_SIZE,
      y: blockY * BLOCK_SIZE
    };
  }

  /**
   * Update screen dimensions (call when window resizes).
   *
   * @param newWidth - New screen width in pixels
   * @param newHeight - New screen height in pixels
   */
  resize(newWidth: number, newHeight: number): void {
    this.screenWidth = newWidth;
    this.screenHeight = newHeight;
  }

  /**
   * Get the range of blocks currently visible on screen.
   * Includes a 2-block buffer for smooth scrolling.
   *
   * @returns Visible block range { startX, startY, endX, endY }
   */
  getVisibleBlockRange(): {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } {
    // Calculate world bounds of visible area
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.screenWidth, this.screenHeight);

    // Convert to block coordinates with 2-block buffer
    const buffer = 2;

    return {
      startX: Math.floor(topLeft.x / BLOCK_SIZE) - buffer,
      startY: Math.floor(topLeft.y / BLOCK_SIZE) - buffer,
      endX: Math.ceil(bottomRight.x / BLOCK_SIZE) + buffer,
      endY: Math.ceil(bottomRight.y / BLOCK_SIZE) + buffer
    };
  }

  /**
   * Get current camera position in world pixels.
   *
   * @returns Camera position { x, y }
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Get current camera position in block coordinates.
   *
   * @returns Camera position in blocks { x, y }
   */
  getBlockPosition(): { x: number; y: number } {
    return {
      x: Math.floor(this.x / BLOCK_SIZE),
      y: Math.floor(this.y / BLOCK_SIZE)
    };
  }

  /**
   * Set camera position immediately (no lerping).
   * Useful for initialization or teleportation.
   *
   * @param worldX - World X position in pixels
   * @param worldY - World Y position in pixels
   */
  setPosition(worldX: number, worldY: number): void {
    this.x = worldX;
    this.y = worldY;
    this.targetX = worldX;
    this.targetY = worldY;
  }

  /**
   * Set camera position in block coordinates.
   *
   * @param blockX - Block X coordinate
   * @param blockY - Block Y coordinate
   */
  setBlockPosition(blockX: number, blockY: number): void {
    const world = this.blockToWorld(blockX, blockY);
    this.setPosition(world.x, world.y);
  }

  /**
   * Get the current shake intensity.
   *
   * @returns Current shake intensity
   */
  getShakeIntensity(): number {
    return this.shakeIntensity;
  }

  /**
   * Check if camera is currently shaking.
   *
   * @returns True if shake is active
   */
  isShaking(): boolean {
    return this.shakeIntensity > 0.5;
  }

  /**
   * Set the lerp factor for camera smoothing.
   * Higher values = faster following, lower = smoother but slower.
   *
   * @param factor - Lerp factor (0-1, default 0.1)
   */
  setLerpFactor(factor: number): void {
    this.lerpFactor = Math.max(0, Math.min(1, factor));
  }
}
