import { Container, Graphics, Text, TextStyle } from 'pixi.js';

interface LeaderboardEntry {
  displayName: string;
  value: number;
}

const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 260;
const LINE_HEIGHT = 20;
const MAX_ENTRIES = 10;

/**
 * Displays the top players leaderboard.
 * Toggleable with Tab key, shows gold or depth rankings.
 */
export class LeaderboardPanel {
  private container: Container;
  private background: Graphics;
  private titleText: Text;
  private entries: Text[] = [];
  private visible = false;
  private mode: 'gold' | 'depth' = 'gold';

  private goldData: LeaderboardEntry[] = [];
  private depthData: LeaderboardEntry[] = [];

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(parentContainer: Container, screenWidth: number) {
    this.container = new Container();
    this.container.x = screenWidth - PANEL_WIDTH - 10;
    this.container.y = 60;
    this.container.visible = false;

    // Background
    this.background = new Graphics();
    this.background.roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 6);
    this.background.fill({ color: 0x000000, alpha: 0.7 });
    this.background.roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 6);
    this.background.stroke({ color: 0xf0a500, width: 1, alpha: 0.5 });
    this.container.addChild(this.background);

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#F0A500',
    });
    this.titleText = new Text({ text: 'Top Gold', style: titleStyle });
    this.titleText.x = 10;
    this.titleText.y = 8;
    this.container.addChild(this.titleText);

    // Toggle hint
    const hintStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 10,
      fill: '#888888',
    });
    const hint = new Text({ text: '[Tab] toggle | [G/D] switch', style: hintStyle });
    hint.x = 10;
    hint.y = PANEL_HEIGHT - 18;
    this.container.addChild(hint);

    parentContainer.addChild(this.container);

    this.setupKeyboard();
  }

  updateData(
    topGold: { displayName: string; gold: number }[],
    topDepth: { displayName: string; maxDepth: number }[]
  ): void {
    this.goldData = topGold.map(e => ({ displayName: e.displayName, value: e.gold }));
    this.depthData = topDepth.map(e => ({ displayName: e.displayName, value: e.maxDepth }));
    if (this.visible) this.refresh();
  }

  private refresh(): void {
    // Remove old entry texts
    for (const t of this.entries) {
      this.container.removeChild(t);
      t.destroy();
    }
    this.entries = [];

    const data = this.mode === 'gold' ? this.goldData : this.depthData;
    this.titleText.text = this.mode === 'gold' ? 'Top Gold' : 'Top Depth';

    const entryStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fill: '#CCCCEE',
    });

    const valueStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: '#88FF88',
    });

    const count = Math.min(data.length, MAX_ENTRIES);
    for (let i = 0; i < count; i++) {
      const entry = data[i];
      const y = 30 + i * LINE_HEIGHT;

      // Rank + name
      const nameText = new Text({
        text: `${i + 1}. ${entry.displayName}`,
        style: entryStyle,
      });
      nameText.x = 10;
      nameText.y = y;
      this.container.addChild(nameText);
      this.entries.push(nameText);

      // Value
      const suffix = this.mode === 'gold' ? 'g' : 'm';
      const valText = new Text({
        text: `${entry.value}${suffix}`,
        style: valueStyle,
      });
      valText.anchor.set(1, 0);
      valText.x = PANEL_WIDTH - 10;
      valText.y = y;
      this.container.addChild(valText);
      this.entries.push(valText);
    }

    if (count === 0) {
      const noData = new Text({ text: 'No data yet', style: entryStyle });
      noData.x = 10;
      noData.y = 30;
      this.container.addChild(noData);
      this.entries.push(noData);
    }
  }

  private setupKeyboard(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.visible = !this.visible;
        this.container.visible = this.visible;
        if (this.visible) this.refresh();
        return;
      }

      if (!this.visible) return;

      if (e.key === 'g' || e.key === 'G') {
        this.mode = 'gold';
        this.refresh();
      } else if (e.key === 'd' || e.key === 'D') {
        this.mode = 'depth';
        this.refresh();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    for (const t of this.entries) {
      t.destroy();
    }
    this.entries = [];
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
