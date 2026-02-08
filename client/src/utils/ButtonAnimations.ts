import { Container, Graphics } from 'pixi.js';
import { easeOutBounce } from './easing';

/**
 * Apply standard button animations for Pixar-quality feel.
 * - Hover: brighten 10%
 * - Press: scale to 0.95
 * - Release: bounce to 1.05 then settle to 1.0
 */
export class ButtonAnimations {
  /**
   * Apply all standard button animations to a button container.
   * @param button - The button container
   * @param background - The button background graphics
   * @param baseColor - The base color of the button (hex number)
   */
  static applyToButton(button: Container, background: Graphics, baseColor: number): void {
    let isPressed = false;
    let bounceStartTime = 0;

    // Hover - brighten 10%
    button.on('pointerover', () => {
      if (!isPressed) {
        const brightColor = this.brightenColor(baseColor, 0.1);
        this.redrawBackground(background, brightColor);
      }
    });

    button.on('pointerout', () => {
      if (!isPressed) {
        this.redrawBackground(background, baseColor);
      }
    });

    // Press - scale to 0.95
    button.on('pointerdown', () => {
      isPressed = true;
      button.scale.set(0.95);
    });

    // Release - bounce animation
    button.on('pointerup', () => {
      isPressed = false;
      bounceStartTime = Date.now();
      this.animateBounce(button, bounceStartTime);

      // Restore base color after release
      setTimeout(() => {
        this.redrawBackground(background, baseColor);
      }, 50);
    });

    // Also handle pointerupoutside
    button.on('pointerupoutside', () => {
      isPressed = false;
      button.scale.set(1.0);
      this.redrawBackground(background, baseColor);
    });
  }

  /**
   * Animate button bounce: scale to 1.05 then settle to 1.0
   */
  private static animateBounce(button: Container, startTime: number): void {
    const duration = 250; // 100ms + 150ms
    const overshoot = 1.05;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        // Use bounce easing
        const eased = easeOutBounce(progress);
        const scale = 0.95 + (overshoot - 0.95) * eased;
        button.scale.set(scale);
        requestAnimationFrame(animate);
      } else {
        button.scale.set(1.0);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Brighten a color by a percentage.
   */
  private static brightenColor(color: number, amount: number): number {
    const r = (color >> 16) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = color & 0xFF;

    const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
    const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
    const newB = Math.min(255, Math.floor(b + (255 - b) * amount));

    return (newR << 16) | (newG << 8) | newB;
  }

  /**
   * Redraw button background with new color.
   * This is a helper that assumes roundRect shape.
   */
  private static redrawBackground(background: Graphics, color: number): void {
    // Store dimensions (assuming they're stored in the graphics object)
    const bounds = background.getBounds();
    background.clear();
    background.roundRect(0, 0, bounds.width, bounds.height, 8);
    background.fill(color);
  }
}
