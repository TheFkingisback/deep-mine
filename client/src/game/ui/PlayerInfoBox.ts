import { Container, Graphics, Text, TextStyle } from 'pixi.js';

interface PlayerInfo {
  playerId: string;
  displayName: string;
  depth: number;
  gold: number;
  itemCount: number;
}

const PANEL_WIDTH = 200;
const LINE_HEIGHT = 50;
const PADDING = 10;

/**
 * Semi-transparent panel at top-right showing all players in the match.
 * Displays name, depth, gold, and item count per player.
 */
export class PlayerInfoBox {
  private container: Container;
  private background: Graphics;
  private playerEntries: Map<string, { container: Container; nameText: Text; infoText: Text }> = new Map();
  private players: Map<string, PlayerInfo> = new Map();

  constructor(parentContainer: Container, screenWidth: number) {
    this.container = new Container();
    this.container.x = screenWidth - PANEL_WIDTH - 10;
    this.container.y = 10;

    this.background = new Graphics();
    this.container.addChild(this.background);

    parentContainer.addChild(this.container);
    this.redrawBackground();
  }

  updatePlayer(info: {
    playerId: string;
    displayName: string;
    x: number;
    y: number;
    gold: number;
    items: { itemType: string; quantity: number }[];
  }): void {
    const itemCount = info.items.reduce((sum, i) => sum + i.quantity, 0);
    this.players.set(info.playerId, {
      playerId: info.playerId,
      displayName: info.displayName,
      depth: info.y,
      gold: info.gold,
      itemCount,
    });
    this.refresh();
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.refresh();
  }

  private refresh(): void {
    // Remove old entries
    for (const [, entry] of this.playerEntries) {
      this.container.removeChild(entry.container);
      entry.container.destroy({ children: true });
    }
    this.playerEntries.clear();

    const nameStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: '#F0A500',
    });

    const infoStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 11,
      fill: '#CCCCEE',
    });

    let y = PADDING;
    for (const [id, player] of this.players) {
      const entry = new Container();
      entry.y = y;
      entry.x = PADDING;

      const nameText = new Text({ text: player.displayName, style: nameStyle });
      entry.addChild(nameText);

      const infoText = new Text({
        text: `Depth: ${player.depth}m  Gold: ${player.gold}  Items: ${player.itemCount}`,
        style: infoStyle,
      });
      infoText.y = 18;
      entry.addChild(infoText);

      this.container.addChild(entry);
      this.playerEntries.set(id, { container: entry, nameText, infoText });

      y += LINE_HEIGHT;
    }

    this.redrawBackground();
  }

  private redrawBackground(): void {
    this.background.clear();
    const height = Math.max(40, this.players.size * LINE_HEIGHT + PADDING * 2);
    this.background.roundRect(0, 0, PANEL_WIDTH, height, 6);
    this.background.fill({ color: 0x000000, alpha: 0.6 });
    this.background.roundRect(0, 0, PANEL_WIDTH, height, 6);
    this.background.stroke({ color: 0xf0a500, width: 1, alpha: 0.4 });
  }

  destroy(): void {
    for (const [, entry] of this.playerEntries) {
      entry.container.destroy({ children: true });
    }
    this.playerEntries.clear();
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
