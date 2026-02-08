import { Application, Text, TextStyle } from 'pixi.js';
import { PlayerRenderer } from '../renderer/PlayerRenderer';
import { EquipmentSlot, EquipmentTier } from '@shared/types';

/**
 * Test scene for PlayerRenderer verification.
 * Renders the player character with animations and keyboard controls.
 */
export class TestPlayerScene {
  private app: Application;
  private playerRenderer: PlayerRenderer;
  private infoText: Text;
  private keyHandler: (e: KeyboardEvent) => void;

  private currentTier = 1;

  constructor(app: Application) {
    this.app = app;
    this.playerRenderer = new PlayerRenderer(this.app.stage);

    // Create info text
    const style = new TextStyle({
      fontFamily: 'Arial, monospace',
      fontSize: 16,
      fill: '#ffffff',
      stroke: { color: '#000000', width: 3 }
    });

    this.infoText = new Text({
      text: this.getInfoText(),
      style
    });

    this.infoText.x = 10;
    this.infoText.y = 10;
    this.app.stage.addChild(this.infoText);

    // Set up keyboard controls
    this.keyHandler = this.handleKeyPress.bind(this);
    window.addEventListener('keydown', this.keyHandler);
  }

  /**
   * Initialize the test scene.
   */
  async init(): Promise<void> {
    console.log('🧪 Initializing PlayerRenderer test scene...');

    // Position player in center of screen
    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;
    this.playerRenderer.setPosition(centerX, centerY);

    // Set initial equipment
    this.updateEquipment();

    console.log('✅ PlayerRenderer test scene initialized');
  }

  /**
   * Handle keyboard input for testing animations.
   */
  private handleKeyPress(e: KeyboardEvent): void {
    switch (e.key.toLowerCase()) {
      case 'd':
        console.log('Playing dig animation');
        this.playerRenderer.playDigAnimation();
        break;

      case 's':
        console.log('Playing stun animation');
        this.playerRenderer.playStunAnimation();
        break;

      case 'c':
        console.log('Playing celebration animation');
        this.playerRenderer.playCelebrationAnimation();
        break;

      case 'arrowleft':
        console.log('Facing left');
        this.playerRenderer.setDirection('left');
        break;

      case 'arrowright':
        console.log('Facing right');
        this.playerRenderer.setDirection('right');
        break;

      case 'arrowdown':
        console.log('Facing down');
        this.playerRenderer.setDirection('down');
        break;

      case '+':
      case '=':
        // Increase equipment tier
        this.currentTier = Math.min(7, this.currentTier + 1);
        this.updateEquipment();
        console.log(`Equipment tier: ${this.currentTier}`);
        break;

      case '-':
      case '_':
        // Decrease equipment tier
        this.currentTier = Math.max(1, this.currentTier - 1);
        this.updateEquipment();
        console.log(`Equipment tier: ${this.currentTier}`);
        break;
    }

    this.infoText.text = this.getInfoText();
  }

  /**
   * Update equipment to current tier.
   */
  private updateEquipment(): void {
    this.playerRenderer.setEquipment({
      [EquipmentSlot.SHOVEL]: this.currentTier as EquipmentTier,
      [EquipmentSlot.HELMET]: this.currentTier as EquipmentTier,
      [EquipmentSlot.VEST]: this.currentTier as EquipmentTier,
      [EquipmentSlot.TORCH]: this.currentTier as EquipmentTier,
      [EquipmentSlot.ROPE]: this.currentTier as EquipmentTier
    });
  }

  /**
   * Get info text for display.
   */
  private getInfoText(): string {
    return [
      'PlayerRenderer Test',
      '',
      'Controls:',
      'D - Dig animation',
      'S - Stun animation',
      'C - Celebration animation',
      'Arrow Keys - Change direction',
      '+/- - Change equipment tier',
      '',
      `Current Tier: ${this.currentTier}/7`,
      '',
      'Idle animation should be playing',
      '(breathing + blinking every 3-5s)'
    ].join('\n');
  }

  /**
   * Update the scene (called every frame).
   */
  update(delta: number): void {
    this.playerRenderer.update(delta);
  }

  /**
   * Clean up the scene.
   */
  destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.playerRenderer.destroy();
    this.app.stage.removeChild(this.infoText);
  }
}
