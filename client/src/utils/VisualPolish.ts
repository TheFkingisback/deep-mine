import { Container, Graphics, TextStyle } from 'pixi.js';
import { easeOutElastic, easeInCubic } from './easing';

/**
 * Visual Polish utilities for Pixar-quality animations and effects.
 */
export class VisualPolish {
  /**
   * Animate panel opening with elastic easing (overshoot 10%, settle over 400ms).
   * @param panel - Panel container to animate
   * @param onComplete - Callback when animation finishes
   */
  static openPanel(panel: Container, onComplete?: () => void): void {
    panel.visible = true;
    panel.scale.set(0);

    const startTime = Date.now();
    const duration = 400;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        const scale = easeOutElastic(progress);
        panel.scale.set(scale);
        requestAnimationFrame(animate);
      } else {
        panel.scale.set(1.0);
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Animate panel closing with ease-in (200ms).
   * @param panel - Panel container to animate
   * @param onComplete - Callback when animation finishes
   */
  static closePanel(panel: Container, onComplete?: () => void): void {
    const startTime = Date.now();
    const duration = 200;
    const startScale = panel.scale.x;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        const scale = startScale * (1 - easeInCubic(progress));
        panel.scale.set(scale);
        requestAnimationFrame(animate);
      } else {
        panel.scale.set(0);
        panel.visible = false;
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Fade in background overlay (200ms).
   * @param overlay - Graphics overlay to fade
   * @param targetAlpha - Target alpha value (default 0.5)
   */
  static fadeInOverlay(overlay: Graphics, targetAlpha: number = 0.5): void {
    overlay.alpha = 0;
    const startTime = Date.now();
    const duration = 200;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        overlay.alpha = targetAlpha * progress;
        requestAnimationFrame(animate);
      } else {
        overlay.alpha = targetAlpha;
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Fade out background overlay (200ms).
   * @param overlay - Graphics overlay to fade
   * @param onComplete - Callback when fade finishes
   */
  static fadeOutOverlay(overlay: Graphics, onComplete?: () => void): void {
    const startAlpha = overlay.alpha;
    const startTime = Date.now();
    const duration = 200;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        overlay.alpha = startAlpha * (1 - progress);
        requestAnimationFrame(animate);
      } else {
        overlay.alpha = 0;
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Create text style with drop shadow for floating text.
   * @param color - Text color (hex string)
   * @param fontSize - Font size (default 16)
   * @returns TextStyle with drop shadow
   */
  static createFloatingTextStyle(color: string, fontSize: number = 16): TextStyle {
    return new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize,
      fontWeight: 'bold',
      fill: color,
      dropShadow: {
        color: '#000000',
        blur: 2,
        angle: Math.PI / 4,
        distance: 1
      }
    });
  }

  /**
   * Player squash animation on landing (scaleX 1.1, scaleY 0.9, 100ms).
   * @param player - Player container
   */
  static playerSquashOnLanding(player: Container): void {
    player.scale.set(1.1, 0.9);

    setTimeout(() => {
      const startTime = Date.now();
      const duration = 100;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          const scaleX = 1.1 - (0.1 * progress);
          const scaleY = 0.9 + (0.1 * progress);
          player.scale.set(scaleX, scaleY);
          requestAnimationFrame(animate);
        } else {
          player.scale.set(1.0, 1.0);
        }
      };

      requestAnimationFrame(animate);
    }, 50);
  }

  /**
   * Create vignette overlay (dark at corners, alpha 0.3).
   * @param width - Screen width
   * @param height - Screen height
   * @returns Graphics vignette overlay
   */
  static createVignetteOverlay(width: number, height: number): Graphics {
    const vignette = new Graphics();

    // Create radial gradient effect by drawing concentric circles
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) * 0.8;

    // Draw from outside to inside for vignette effect
    const steps = 20;
    for (let i = steps; i >= 0; i--) {
      const radius = (maxRadius / steps) * i;
      const alpha = (1 - i / steps) * 0.3; // Max 0.3 alpha at edges

      vignette.circle(centerX, centerY, radius);
      vignette.fill({ color: 0x000000, alpha });
    }

    return vignette;
  }

  /**
   * Trigger block break ripple effect on neighboring blocks.
   * @param neighborBlocks - Array of neighboring block graphics
   */
  static blockBreakRipple(neighborBlocks: Graphics[]): void {
    const duration = 100;
    const jitterAmount = 2;

    neighborBlocks.forEach((block, index) => {
      const delay = index * 15; // Stagger the effect
      const originalX = block.x;
      const originalY = block.y;

      setTimeout(() => {
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          if (progress < 1) {
            // Random jitter that decreases over time
            const intensity = (1 - progress) * jitterAmount;
            block.x = originalX + (Math.random() - 0.5) * intensity;
            block.y = originalY + (Math.random() - 0.5) * intensity;
            requestAnimationFrame(animate);
          } else {
            block.x = originalX;
            block.y = originalY;
          }
        };

        requestAnimationFrame(animate);
      }, delay);
    });
  }
}
