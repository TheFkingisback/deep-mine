import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { getLayerAtDepth } from '@shared/layers';
import { LayerName, LayerDefinition } from '@shared/types';
import { audioManager } from '../../audio/AudioManager';

/**
 * LayerTransition manages visual banners when crossing layer boundaries.
 * Shows layer name, depth range, and smoothly transitions background colors.
 */
export class LayerTransition {
  private app: Application;
  private stage: Container;
  private bannerContainer: Container;
  private currentLayerName: LayerName | null = null;
  private isAnimating = false;

  // Background color transition
  private backgroundOverlay: Graphics;
  private targetColor = 0xD4A574; // Default to dirt layer color
  private currentColor = 0xD4A574;
  private colorTransitionProgress = 1.0;
  private colorTransitionDuration = 1000; // ms

  constructor(app: Application, stage: Container) {
    this.app = app;
    this.stage = stage;

    // Create banner container (will be added to stage when needed)
    this.bannerContainer = new Container();

    // Create background color overlay
    this.backgroundOverlay = new Graphics();
    this.backgroundOverlay.rect(0, 0, app.screen.width, app.screen.height);
    this.backgroundOverlay.fill({ color: this.currentColor, alpha: 0.2 });
    stage.addChildAt(this.backgroundOverlay, 0); // Add at bottom
  }

  /**
   * Check if player has transitioned to a new layer.
   * Call this every frame or when depth changes significantly.
   */
  checkTransition(depth: number): void {
    const layer = getLayerAtDepth(depth);

    // Check if layer has changed
    if (this.currentLayerName !== layer.name) {
      this.currentLayerName = layer.name;
      this.showBanner(layer);
    }
  }

  /**
   * Show layer transition banner with animation.
   */
  showBanner(layer: LayerDefinition): void {
    // Skip if already animating
    if (this.isAnimating) {
      return;
    }

    this.isAnimating = true;

    // Clear previous banner
    this.bannerContainer.removeChildren();

    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;
    const bannerHeight = 60;
    const bannerY = (screenHeight - bannerHeight) / 2;

    // Parse ambient color (hex string to number)
    const ambientColor = parseInt(layer.ambientColor.replace('#', ''), 16);
    const accentColor = parseInt(layer.color.replace('#', ''), 16);

    // Create banner background
    const background = new Graphics();
    background.roundRect(0, 0, screenWidth, bannerHeight, 8);
    background.fill({ color: ambientColor, alpha: 0.85 });
    background.y = bannerY;
    this.bannerContainer.addChild(background);

    // Create accent lines (top and bottom)
    const topLine = new Graphics();
    topLine.rect(0, 0, screenWidth, 2);
    topLine.fill({ color: accentColor });
    topLine.y = bannerY;
    this.bannerContainer.addChild(topLine);

    const bottomLine = new Graphics();
    bottomLine.rect(0, 0, screenWidth, 2);
    bottomLine.fill({ color: accentColor });
    bottomLine.y = bannerY + bannerHeight - 2;
    this.bannerContainer.addChild(bottomLine);

    // Create title text
    const titleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#FFFFFF',
      dropShadow: {
        color: '#000000',
        blur: 4,
        angle: Math.PI / 4,
        distance: 2
      }
    });
    const title = new Text({ text: `★ ${layer.displayName} ★`, style: titleStyle });
    title.anchor.set(0.5);
    title.x = screenWidth / 2;
    title.y = bannerY + 20;
    title.alpha = 0; // Start invisible
    this.bannerContainer.addChild(title);

    // Create subtitle text (depth range)
    const depthRange = layer.depthEnd === Infinity
      ? `Depth ${layer.depthStart}+`
      : `Depth ${layer.depthStart} - ${layer.depthEnd}`;

    const subtitleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fill: '#AAAAAA',
      dropShadow: {
        color: '#000000',
        blur: 3,
        angle: Math.PI / 4,
        distance: 1
      }
    });
    const subtitle = new Text({ text: depthRange, style: subtitleStyle });
    subtitle.anchor.set(0.5);
    subtitle.x = screenWidth / 2;
    subtitle.y = bannerY + 42;
    subtitle.alpha = 0; // Start invisible
    this.bannerContainer.addChild(subtitle);

    // Add banner to stage
    this.stage.addChild(this.bannerContainer);

    // Start background color transition
    this.targetColor = ambientColor;
    this.colorTransitionProgress = 0;

    // Play notification sound
    audioManager.playSFX('button_click');

    // Animate banner slide in from left
    background.x = -screenWidth;
    topLine.x = -screenWidth;
    bottomLine.x = -screenWidth;

    this.animateBannerSlideIn(background, topLine, bottomLine, title, subtitle);
  }

  /**
   * Animate banner slide in, hold, and slide out.
   */
  private animateBannerSlideIn(
    background: Graphics,
    topLine: Graphics,
    bottomLine: Graphics,
    title: Text,
    subtitle: Text
  ): void {
    const screenWidth = this.app.screen.width;
    const slideInDuration = 300;
    const holdDuration = 2000;
    const slideOutDuration = 300;

    let elapsed = 0;

    const animate = () => {
      elapsed += 16.67; // Assume ~60fps

      if (elapsed < slideInDuration) {
        // Slide in from left (ease-out)
        const progress = elapsed / slideInDuration;
        const eased = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
        const x = -screenWidth + (screenWidth * eased);

        background.x = x;
        topLine.x = x;
        bottomLine.x = x;

        // Fade in title
        if (elapsed > 100) {
          title.alpha = Math.min(1, (elapsed - 100) / 200);
        }

        // Fade in subtitle
        if (elapsed > 200) {
          subtitle.alpha = Math.min(1, (elapsed - 200) / 300);
        }

        requestAnimationFrame(animate);
      } else if (elapsed < slideInDuration + holdDuration) {
        // Hold position
        background.x = 0;
        topLine.x = 0;
        bottomLine.x = 0;
        title.alpha = 1;
        subtitle.alpha = 1;

        requestAnimationFrame(animate);
      } else if (elapsed < slideInDuration + holdDuration + slideOutDuration) {
        // Slide out to right (ease-in)
        const progress = (elapsed - slideInDuration - holdDuration) / slideOutDuration;
        const eased = Math.pow(progress, 3); // Cubic ease-in
        const x = screenWidth * eased;

        background.x = x;
        topLine.x = x;
        bottomLine.x = x;

        // Fade out
        title.alpha = 1 - progress;
        subtitle.alpha = 1 - progress;

        requestAnimationFrame(animate);
      } else {
        // Animation complete - clean up
        this.stage.removeChild(this.bannerContainer);
        this.bannerContainer.removeChildren();
        this.isAnimating = false;
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Update background color transition (call every frame).
   */
  update(deltaMs: number): void {
    // Update color transition
    if (this.colorTransitionProgress < 1.0) {
      this.colorTransitionProgress += deltaMs / this.colorTransitionDuration;
      this.colorTransitionProgress = Math.min(1.0, this.colorTransitionProgress);

      // Interpolate color (simple lerp for each channel)
      const r1 = (this.currentColor >> 16) & 0xFF;
      const g1 = (this.currentColor >> 8) & 0xFF;
      const b1 = this.currentColor & 0xFF;

      const r2 = (this.targetColor >> 16) & 0xFF;
      const g2 = (this.targetColor >> 8) & 0xFF;
      const b2 = this.targetColor & 0xFF;

      const r = Math.round(r1 + (r2 - r1) * this.colorTransitionProgress);
      const g = Math.round(g1 + (g2 - g1) * this.colorTransitionProgress);
      const b = Math.round(b1 + (b2 - b1) * this.colorTransitionProgress);

      const interpolatedColor = (r << 16) | (g << 8) | b;

      // Update background overlay
      this.backgroundOverlay.clear();
      this.backgroundOverlay.rect(0, 0, this.app.screen.width, this.app.screen.height);
      this.backgroundOverlay.fill({ color: interpolatedColor, alpha: 0.2 });

      // Update current color when transition is complete
      if (this.colorTransitionProgress >= 1.0) {
        this.currentColor = this.targetColor;
      }
    }
  }

  /**
   * Resize handler for background overlay.
   */
  resize(width: number, height: number): void {
    this.backgroundOverlay.clear();
    this.backgroundOverlay.rect(0, 0, width, height);
    this.backgroundOverlay.fill({ color: this.currentColor, alpha: 0.2 });
  }

  /**
   * Clean up.
   */
  destroy(): void {
    this.stage.removeChild(this.bannerContainer);
    this.bannerContainer.destroy({ children: true });
    this.backgroundOverlay.destroy();
  }
}
