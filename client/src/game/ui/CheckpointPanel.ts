import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * CheckpointPanel allows players to select which checkpoint/depth to descend to.
 * Shown when clicking the mine entrance from the surface.
 */
export class CheckpointPanel {
  private app: Application;
  private container: Container;
  private background: Graphics;
  private panel: Container;
  private isOpen = false;

  private onSelectCallback: ((depth: number) => void) | null = null;

  constructor(app: Application, onSelect: (depth: number) => void) {
    this.app = app;
    this.onSelectCallback = onSelect;

    // Create main container
    this.container = new Container();
    this.container.visible = false;

    // Background overlay
    this.background = new Graphics();
    this.background.eventMode = 'static';
    this.background.on('pointerdown', () => this.close());
    this.container.addChild(this.background);

    // Panel
    this.panel = new Container();
    this.container.addChild(this.panel);

    // Add to stage
    this.app.stage.addChild(this.container);

    this.renderBackground();
  }

  /**
   * Render dark background overlay.
   */
  private renderBackground(): void {
    this.background.clear();
    this.background.rect(0, 0, this.app.screen.width, this.app.screen.height);
    this.background.fill({ color: 0x000000, alpha: 0.5 });
  }

  /**
   * Open the checkpoint selection panel.
   */
  open(checkpoints: number[]): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.container.visible = true;

    this.populatePanel(checkpoints);
  }

  /**
   * Close the checkpoint panel.
   */
  close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.container.visible = false;
  }

  /**
   * Populate panel with checkpoint options.
   */
  private populatePanel(checkpoints: number[]): void {
    this.panel.removeChildren();

    const panelWidth = 400;
    const panelHeight = 300 + checkpoints.length * 60;
    const panelX = (this.app.screen.width - panelWidth) / 2;
    const panelY = (this.app.screen.height - panelHeight) / 2;

    // Panel background
    const bg = new Graphics();
    bg.roundRect(0, 0, panelWidth, panelHeight, 12);
    bg.fill(0x1E1E2E);
    this.panel.addChild(bg);

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const title = new Text({ text: 'SELECT DEPTH', style: titleStyle });
    title.anchor.set(0.5, 0);
    title.x = panelWidth / 2;
    title.y = 20;
    this.panel.addChild(title);

    // Close button
    const closeButton = this.createCloseButton();
    closeButton.x = panelWidth - 35;
    closeButton.y = 20;
    this.panel.addChild(closeButton);

    let yOffset = 80;

    // "Start from top" option
    const topButton = this.createDepthButton('Start from Top (Depth 0)', 0, panelWidth);
    topButton.y = yOffset;
    topButton.on('pointerup', () => {
      if (this.onSelectCallback) {
        this.onSelectCallback(0);
      }
      this.close();
    });
    this.panel.addChild(topButton);
    yOffset += 70;

    // Checkpoint options
    checkpoints.sort((a, b) => a - b); // Sort by depth
    checkpoints.forEach((depth) => {
      const button = this.createDepthButton(`Checkpoint at Depth ${depth}`, depth, panelWidth);
      button.y = yOffset;
      button.on('pointerup', () => {
        if (this.onSelectCallback) {
          this.onSelectCallback(depth);
        }
        this.close();
      });
      this.panel.addChild(button);
      yOffset += 70;
    });

    this.panel.x = panelX;
    this.panel.y = panelY;
  }

  /**
   * Create close button.
   */
  private createCloseButton(): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.circle(12, 12, 12);
    bg.fill({ color: 0x333333 });
    button.addChild(bg);

    const xStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const x = new Text({ text: '×', style: xStyle });
    x.anchor.set(0.5);
    x.x = 12;
    x.y = 12;
    button.addChild(x);

    button.on('pointerover', () => {
      bg.clear();
      bg.circle(12, 12, 12);
      bg.fill({ color: 0xFF0000 });
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.circle(12, 12, 12);
      bg.fill({ color: 0x333333 });
    });

    button.on('pointerup', () => {
      this.close();
    });

    return button;
  }

  /**
   * Create a depth selection button.
   */
  private createDepthButton(text: string, depth: number, panelWidth: number): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(20, 0, panelWidth - 40, 50, 8);
    bg.fill(0x2A2A3A);
    button.addChild(bg);

    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const label = new Text({ text, style: textStyle });
    label.anchor.set(0.5);
    label.x = panelWidth / 2;
    label.y = 25;
    button.addChild(label);

    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(20, 0, panelWidth - 40, 50, 8);
      bg.fill(0x3A3A4A);
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(20, 0, panelWidth - 40, 50, 8);
      bg.fill(0x2A2A3A);
    });

    button.on('pointerdown', () => {
      button.scale.set(0.98);
    });

    button.on('pointerup', () => {
      button.scale.set(1.0);
    });

    return button;
  }

  /**
   * Clean up the panel.
   */
  destroy(): void {
    this.app.stage.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
