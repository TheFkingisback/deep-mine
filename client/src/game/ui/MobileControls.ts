import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';

type Direction = 'up' | 'down' | 'left' | 'right';

interface DPadButton {
  direction: Direction;
  graphic: Graphics;
  label: Text;
  pressed: boolean;
}

/**
 * Virtual touch controls for mobile devices.
 * Renders a D-pad (left side) and action button (right side).
 * Only appears when touch events are detected.
 */
export class MobileControls {
  private container: Container;
  private dpadButtons: DPadButton[] = [];
  private digButton: Graphics;
  private digLabel: Text;
  private activeDirections = new Set<Direction>();
  private digPressed = false;
  private enabled = false;

  private onDirection: ((dx: number, dy: number) => void) | null = null;
  private onDig: (() => void) | null = null;

  constructor(parentContainer: Container, screenWidth: number, screenHeight: number) {
    this.container = new Container();
    this.container.visible = false;

    // Check for touch support
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this.enabled = true;
      this.container.visible = true;
    }

    // D-pad (bottom-left)
    const padCenterX = 90;
    const padCenterY = screenHeight - 100;
    const btnSize = 50;
    const gap = 4;

    this.createDPadButton('up', padCenterX, padCenterY - btnSize - gap, btnSize);
    this.createDPadButton('down', padCenterX, padCenterY + btnSize + gap, btnSize);
    this.createDPadButton('left', padCenterX - btnSize - gap, padCenterY, btnSize);
    this.createDPadButton('right', padCenterX + btnSize + gap, padCenterY, btnSize);

    // Center decoration
    const center = new Graphics();
    center.circle(padCenterX, padCenterY, 15);
    center.fill({ color: 0x333333, alpha: 0.5 });
    this.container.addChild(center);

    // Dig button (bottom-right)
    const digX = screenWidth - 90;
    const digY = screenHeight - 100;

    this.digButton = new Graphics();
    this.digButton.circle(0, 0, 40);
    this.digButton.fill({ color: 0xcc4444, alpha: 0.6 });
    this.digButton.circle(0, 0, 40);
    this.digButton.stroke({ color: 0xff6666, width: 2, alpha: 0.8 });
    this.digButton.x = digX;
    this.digButton.y = digY;
    this.digButton.eventMode = 'static';

    const digStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#FFFFFF',
    });
    this.digLabel = new Text({ text: 'DIG', style: digStyle });
    this.digLabel.anchor.set(0.5, 0.5);
    this.digLabel.x = digX;
    this.digLabel.y = digY;

    this.digButton.on('pointerdown', () => {
      this.digPressed = true;
      this.digButton.alpha = 0.8;
      if (this.onDig) this.onDig();
    });
    this.digButton.on('pointerup', () => {
      this.digPressed = false;
      this.digButton.alpha = 1;
    });
    this.digButton.on('pointerupoutside', () => {
      this.digPressed = false;
      this.digButton.alpha = 1;
    });

    this.container.addChild(this.digButton);
    this.container.addChild(this.digLabel);

    parentContainer.addChild(this.container);
  }

  private createDPadButton(direction: Direction, x: number, y: number, size: number): void {
    const g = new Graphics();
    g.roundRect(-size / 2, -size / 2, size, size, 6);
    g.fill({ color: 0x444466, alpha: 0.6 });
    g.roundRect(-size / 2, -size / 2, size, size, 6);
    g.stroke({ color: 0x6666aa, width: 1, alpha: 0.5 });
    g.x = x;
    g.y = y;
    g.eventMode = 'static';

    const arrows: Record<Direction, string> = {
      up: '\u25B2',
      down: '\u25BC',
      left: '\u25C0',
      right: '\u25B6',
    };

    const style = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 20,
      fill: '#AAAACC',
    });
    const label = new Text({ text: arrows[direction], style });
    label.anchor.set(0.5, 0.5);
    label.x = x;
    label.y = y;

    const btn: DPadButton = { direction, graphic: g, label, pressed: false };
    this.dpadButtons.push(btn);

    g.on('pointerdown', (_e: FederatedPointerEvent) => {
      btn.pressed = true;
      this.activeDirections.add(direction);
      g.alpha = 0.8;
      this.emitDirection();
    });
    g.on('pointerup', () => {
      btn.pressed = false;
      this.activeDirections.delete(direction);
      g.alpha = 1;
      this.emitDirection();
    });
    g.on('pointerupoutside', () => {
      btn.pressed = false;
      this.activeDirections.delete(direction);
      g.alpha = 1;
      this.emitDirection();
    });

    this.container.addChild(g);
    this.container.addChild(label);
  }

  private emitDirection(): void {
    if (!this.onDirection) return;

    let dx = 0;
    let dy = 0;
    if (this.activeDirections.has('left')) dx -= 1;
    if (this.activeDirections.has('right')) dx += 1;
    if (this.activeDirections.has('up')) dy -= 1;
    if (this.activeDirections.has('down')) dy += 1;

    this.onDirection(dx, dy);
  }

  setDirectionCallback(cb: (dx: number, dy: number) => void): void {
    this.onDirection = cb;
  }

  setDigCallback(cb: () => void): void {
    this.onDig = cb;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isDigPressed(): boolean {
    return this.digPressed;
  }

  show(): void {
    this.container.visible = true;
  }

  hide(): void {
    this.container.visible = false;
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
    this.dpadButtons = [];
  }
}
