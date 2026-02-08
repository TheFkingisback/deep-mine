import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * Floating text animation data.
 */
interface FloatingText {
  text: Text;
  vy: number;
  lifetime: number;
  elapsed: number;
  startAlpha: number;
}

/**
 * HUD (Heads-Up Display) overlay showing essential game information.
 * Fixed on screen, not affected by camera movement.
 * Always renders on top of game elements.
 */
export class HUD {
  private app: Application;
  private container: Container;

  // Display texts
  private goldText: Text;
  private depthText: Text;
  private inventoryText: Text;
  private checkpointText: Text; // Checkpoint button text

  // Buttons
  private surfaceButton: Container;
  private checkpointButton: Container;
  private inventoryButton: Container;

  // Gold rolling animation
  private displayedGold = 0;
  private targetGold = 0;
  private goldRollingSpeed = 0.1; // 10% closer each frame

  // Floating texts
  private floatingTexts: FloatingText[] = [];

  // Button callbacks
  private onSurfaceClick: (() => void) | null = null;
  private onInventoryClick: (() => void) | null = null;
  private onCheckpointClick: (() => void) | null = null;

  constructor(app: Application) {
    this.app = app;

    // Create container (will be added LAST to stage for top rendering)
    this.container = new Container();

    // Create display elements
    this.goldText = this.createGoldDisplay();
    this.depthText = this.createDepthDisplay();
    this.inventoryText = this.createInventoryDisplay();

    // Create buttons
    this.surfaceButton = this.createSurfaceButton();
    this.checkpointButton = this.createCheckpointButton();
    this.inventoryButton = this.createInventoryButton();

    // Add all to container
    this.container.addChild(this.goldText);
    this.container.addChild(this.depthText);
    this.container.addChild(this.inventoryText);
    this.container.addChild(this.surfaceButton);
    this.container.addChild(this.checkpointButton);
    this.container.addChild(this.inventoryButton);

    // Add container to stage LAST (renders on top)
    this.app.stage.addChild(this.container);

    // Initial positioning
    this.resize(this.app.screen.width, this.app.screen.height);
  }

  /**
   * Create gold display text (top-left).
   */
  private createGoldDisplay(): Text {
    const style = new TextStyle({
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: '#FFD700',
      dropShadow: {
        color: '#000000',
        blur: 3,
        angle: Math.PI / 4,
        distance: 2
      }
    });

    const text = new Text({ text: 'G 0', style });
    text.x = 10;
    text.y = 10;

    return text;
  }

  /**
   * Create depth display text (top-right).
   */
  private createDepthDisplay(): Text {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fill: '#FFFFFF',
      dropShadow: {
        color: '#000000',
        blur: 3,
        angle: Math.PI / 4,
        distance: 2
      }
    });

    const text = new Text({ text: 'Depth: 0', style });

    return text;
  }

  /**
   * Create inventory display text (top-center).
   */
  private createInventoryDisplay(): Text {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fill: '#FFFFFF',
      dropShadow: {
        color: '#000000',
        blur: 3,
        angle: Math.PI / 4,
        distance: 2
      }
    });

    const text = new Text({ text: 'Inventory: 0 / 8', style });

    return text;
  }

  /**
   * Create Surface button (bottom-left).
   */
  private createSurfaceButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, 140, 40, 8);
    bg.fill('#4A90D9');
    button.addChild(bg);

    // Text
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fill: '#FFFFFF',
      fontWeight: 'bold'
    });
    const text = new Text({ text: '⬆ Surface', style });
    text.anchor.set(0.5);
    text.x = 70;
    text.y = 20;
    button.addChild(text);

    // Hover effect
    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, 140, 40, 8);
      bg.fill('#5BA0E9');
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, 140, 40, 8);
      bg.fill('#4A90D9');
    });

    // Click effect
    button.on('pointerdown', () => {
      button.scale.set(0.95);
    });

    button.on('pointerup', () => {
      button.scale.set(1.0);
      if (this.onSurfaceClick) {
        this.onSurfaceClick();
      }
    });

    return button;
  }

  /**
   * Create Checkpoint button (bottom-center).
   */
  private createCheckpointButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.visible = false; // Hidden by default

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, 120, 36, 8);
    bg.fill('#4CAF50');
    button.addChild(bg);

    // Text
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fill: '#FFFFFF',
      fontWeight: 'bold'
    });
    this.checkpointText = new Text({ text: '📍 0/0', style });
    this.checkpointText.anchor.set(0.5);
    this.checkpointText.x = 60;
    this.checkpointText.y = 18;
    button.addChild(this.checkpointText);

    // Hover effect
    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, 120, 36, 8);
      bg.fill('#5CBF60');
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, 120, 36, 8);
      bg.fill('#4CAF50');
    });

    // Click effect
    button.on('pointerdown', () => {
      button.scale.set(0.95);
    });

    button.on('pointerup', () => {
      button.scale.set(1.0);
      if (this.onCheckpointClick) {
        this.onCheckpointClick();
      }
    });

    return button;
  }

  /**
   * Create Inventory button (bottom-right).
   */
  private createInventoryButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    // Background
    const bg = new Graphics();
    bg.roundRect(0, 0, 120, 40, 8);
    bg.fill('#8B6914');
    button.addChild(bg);

    // Text
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fill: '#FFFFFF',
      fontWeight: 'bold'
    });
    const text = new Text({ text: '📦 Items', style });
    text.anchor.set(0.5);
    text.x = 60;
    text.y = 20;
    button.addChild(text);

    // Hover effect
    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, 120, 40, 8);
      bg.fill('#9B7924');
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, 120, 40, 8);
      bg.fill('#8B6914');
    });

    // Click effect
    button.on('pointerdown', () => {
      button.scale.set(0.95);
    });

    button.on('pointerup', () => {
      button.scale.set(1.0);
      if (this.onInventoryClick) {
        this.onInventoryClick();
      }
    });

    return button;
  }

  /**
   * Update gold display with smooth rolling animation.
   * Flashes green on increase, red on decrease.
   *
   * @param newAmount - New gold amount
   */
  updateGold(newAmount: number): void {
    const oldTarget = this.targetGold;
    this.targetGold = newAmount;

    // Flash effect on change
    if (newAmount > oldTarget) {
      // Increase - flash green
      this.goldText.style.fill = '#00FF00';
      setTimeout(() => {
        this.goldText.style.fill = '#FFD700';
      }, 200);
    } else if (newAmount < oldTarget) {
      // Decrease - flash red
      this.goldText.style.fill = '#FF0000';
      setTimeout(() => {
        this.goldText.style.fill = '#FFD700';
      }, 200);
    }
  }

  /**
   * Update depth display.
   *
   * @param depth - Current depth
   */
  updateDepth(depth: number): void {
    this.depthText.text = `Depth: ${depth}`;
  }

  /**
   * Update inventory display with color coding.
   *
   * @param used - Number of used slots
   * @param max - Maximum slots
   */
  updateInventory(used: number, max: number): void {
    this.inventoryText.text = `Inventory: ${used} / ${max}`;

    const percentage = used / max;

    if (percentage >= 1.0) {
      // Full - red with pulse
      this.inventoryText.style.fill = '#FF4444';
    } else if (percentage >= 0.8) {
      // Nearly full - yellow
      this.inventoryText.style.fill = '#FFEB3B';
    } else {
      // Normal - white
      this.inventoryText.style.fill = '#FFFFFF';
    }
  }

  /**
   * Update checkpoint button display.
   * Shows "📍 {current}/{max}" and only visible when max > 0.
   *
   * @param current - Current number of saved checkpoints
   * @param max - Maximum checkpoints allowed
   */
  updateCheckpoints(current: number, max: number): void {
    this.checkpointText.text = `📍 ${current}/${max}`;
    this.checkpointButton.visible = max > 0;
  }

  /**
   * Show floating text that moves up and fades out.
   *
   * @param text - Text to display
   * @param screenX - Screen X position
   * @param screenY - Screen Y position
   * @param color - Text color (hex string)
   */
  showFloatingText(text: string, screenX: number, screenY: number, color: string): void {
    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: color,
      dropShadow: {
        color: '#000000',
        blur: 4,
        angle: Math.PI / 4,
        distance: 2
      }
    });

    const floatingText = new Text({ text, style });
    floatingText.anchor.set(0.5);
    floatingText.x = screenX;
    floatingText.y = screenY;

    this.container.addChild(floatingText);

    this.floatingTexts.push({
      text: floatingText,
      vy: -1.5, // pixels per frame
      lifetime: 800, // ms
      elapsed: 0,
      startAlpha: 1.0
    });
  }

  /**
   * Set button visibility.
   *
   * @param button - Button identifier
   * @param visible - Whether button should be visible
   */
  setButtonVisibility(button: 'surface' | 'checkpoint' | 'inventory', visible: boolean): void {
    switch (button) {
      case 'surface':
        this.surfaceButton.visible = visible;
        break;
      case 'checkpoint':
        this.checkpointButton.visible = visible;
        break;
      case 'inventory':
        this.inventoryButton.visible = visible;
        break;
    }
  }

  /**
   * Set button click callbacks.
   *
   * @param button - Button identifier
   * @param callback - Callback function
   */
  setButtonCallback(button: 'surface' | 'checkpoint' | 'inventory', callback: () => void): void {
    switch (button) {
      case 'surface':
        this.onSurfaceClick = callback;
        break;
      case 'checkpoint':
        this.onCheckpointClick = callback;
        break;
      case 'inventory':
        this.onInventoryClick = callback;
        break;
    }
  }

  /**
   * Update HUD animations (called every frame).
   *
   * @param deltaMs - Time elapsed since last update in milliseconds
   */
  update(deltaMs: number): void {
    // Animate gold rolling
    if (Math.abs(this.targetGold - this.displayedGold) > 0.1) {
      this.displayedGold += (this.targetGold - this.displayedGold) * this.goldRollingSpeed;

      // Format with commas
      const formattedGold = Math.floor(this.displayedGold).toLocaleString();
      this.goldText.text = `G ${formattedGold}`;
    } else {
      // Snap to target when close enough
      this.displayedGold = this.targetGold;
      const formattedGold = Math.floor(this.displayedGold).toLocaleString();
      this.goldText.text = `G ${formattedGold}`;
    }

    // Update floating texts
    const toRemove: number[] = [];

    this.floatingTexts.forEach((ft, index) => {
      ft.elapsed += deltaMs;

      // Move upward
      ft.text.y += ft.vy;

      // Fade out
      const progress = ft.elapsed / ft.lifetime;
      ft.text.alpha = ft.startAlpha * (1 - progress);

      // Mark for removal when done
      if (ft.elapsed >= ft.lifetime) {
        toRemove.push(index);
      }
    });

    // Remove dead floating texts
    toRemove.reverse().forEach(index => {
      const ft = this.floatingTexts[index];
      this.container.removeChild(ft.text);
      ft.text.destroy();
      this.floatingTexts.splice(index, 1);
    });

    // Pulse inventory text when full
    if (this.inventoryText.style.fill === '#FF4444') {
      const pulsePhase = Date.now() * 0.003;
      this.inventoryText.alpha = 0.7 + Math.sin(pulsePhase) * 0.3;
    } else {
      this.inventoryText.alpha = 1.0;
    }
  }

  /**
   * Resize handler to reposition HUD elements.
   *
   * @param width - New screen width
   * @param height - New screen height
   */
  resize(width: number, height: number): void {
    // Top-left: Gold
    this.goldText.x = 10;
    this.goldText.y = 10;

    // Top-right: Depth
    this.depthText.x = width - this.depthText.width - 10;
    this.depthText.y = 10;

    // Top-center: Inventory
    this.inventoryText.x = width / 2 - this.inventoryText.width / 2;
    this.inventoryText.y = 10;

    // Bottom-left: Surface button
    this.surfaceButton.x = 10;
    this.surfaceButton.y = height - 50;

    // Bottom-center: Checkpoint button
    this.checkpointButton.x = width / 2 - 60;
    this.checkpointButton.y = height - 46;

    // Bottom-right: Inventory button
    this.inventoryButton.x = width - 130;
    this.inventoryButton.y = height - 50;
  }

  /**
   * Clean up the HUD.
   */
  destroy(): void {
    // Clean up floating texts
    this.floatingTexts.forEach(ft => {
      this.container.removeChild(ft.text);
      ft.text.destroy();
    });
    this.floatingTexts = [];

    // Destroy container
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
