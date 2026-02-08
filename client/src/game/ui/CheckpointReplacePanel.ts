import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * CheckpointReplacePanel shows when checkpoint slots are full.
 * Allows player to replace an existing checkpoint with the current depth.
 */
export class CheckpointReplacePanel {
  private app: Application;
  private container: Container;
  private background: Graphics;
  private panel: Container;
  private isOpen = false;

  private onReplaceCallback: ((oldDepth: number, newDepth: number) => void) | null = null;

  constructor(app: Application, onReplace: (oldDepth: number, newDepth: number) => void) {
    this.app = app;
    this.onReplaceCallback = onReplace;

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
   * Open the checkpoint replace panel.
   */
  open(existingCheckpoints: number[], currentDepth: number): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.container.visible = true;

    this.populatePanel(existingCheckpoints, currentDepth);
  }

  /**
   * Close the checkpoint replace panel.
   */
  close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.container.visible = false;
  }

  /**
   * Populate panel with replace options.
   */
  private populatePanel(checkpoints: number[], currentDepth: number): void {
    this.panel.removeChildren();

    const panelWidth = 450;
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
    const title = new Text({ text: 'CHECKPOINT SLOTS FULL', style: titleStyle });
    title.anchor.set(0.5, 0);
    title.x = panelWidth / 2;
    title.y = 20;
    this.panel.addChild(title);

    // Subtitle
    const subtitleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fill: '#AAAAAA'
    });
    const subtitle = new Text({ text: 'Replace an existing checkpoint?', style: subtitleStyle });
    subtitle.anchor.set(0.5, 0);
    subtitle.x = panelWidth / 2;
    subtitle.y = 55;
    this.panel.addChild(subtitle);

    // Close button
    const closeButton = this.createCloseButton();
    closeButton.x = panelWidth - 35;
    closeButton.y = 20;
    this.panel.addChild(closeButton);

    let yOffset = 100;

    // Existing checkpoint options (sorted)
    const sortedCheckpoints = [...checkpoints].sort((a, b) => a - b);
    sortedCheckpoints.forEach((depth) => {
      const button = this.createReplaceButton(depth, currentDepth, panelWidth);
      button.y = yOffset;
      button.on('pointerup', () => {
        if (this.onReplaceCallback) {
          this.onReplaceCallback(depth, currentDepth);
        }
        this.close();
      });
      this.panel.addChild(button);
      yOffset += 70;
    });

    // Cancel button
    const cancelButton = this.createCancelButton(panelWidth);
    cancelButton.y = yOffset;
    cancelButton.on('pointerup', () => {
      this.close();
    });
    this.panel.addChild(cancelButton);

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
   * Create a replace button for a checkpoint.
   */
  private createReplaceButton(oldDepth: number, newDepth: number, panelWidth: number): Container {
    const button = new Container();
    button.eventMode = 'static';
    button.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(20, 0, panelWidth - 40, 50, 8);
    bg.fill(0x4A2A2A);
    button.addChild(bg);

    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#FFFFFF'
    });
    const label = new Text({
      text: `Replace Depth ${oldDepth} → New Depth ${newDepth}`,
      style: textStyle
    });
    label.anchor.set(0.5);
    label.x = panelWidth / 2;
    label.y = 25;
    button.addChild(label);

    button.on('pointerover', () => {
      bg.clear();
      bg.roundRect(20, 0, panelWidth - 40, 50, 8);
      bg.fill(0x6A3A3A);
    });

    button.on('pointerout', () => {
      bg.clear();
      bg.roundRect(20, 0, panelWidth - 40, 50, 8);
      bg.fill(0x4A2A2A);
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
   * Create cancel button.
   */
  private createCancelButton(panelWidth: number): Container {
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
    const label = new Text({ text: 'CANCEL', style: textStyle });
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
