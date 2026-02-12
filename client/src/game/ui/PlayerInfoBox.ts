import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { ITEMS } from '@shared/items';

interface PlayerInfo {
  playerId: string;
  displayName: string;
  x: number;
  y: number;
  gold: number;
  items: { itemType: string; quantity: number }[];
  equipment: Record<string, number>;
}

const PANEL_WIDTH = 240;
const LINE_HEIGHT = 72;
const PADDING = 10;

const EQUIP_EMOJI: Record<string, string> = {
  shovel: '\u26CF\uFE0F',
  helmet: '\uD83E\uDE96',
  vest: '\uD83E\uDDBA',
  torch: '\uD83D\uDD26',
  rope: '\uD83E\uDEA2',
};

/**
 * Semi-transparent panel at top-right showing all players in the match.
 * Displays name, position, gold, items with emojis, and equipment.
 */
export class PlayerInfoBox {
  private container: Container;
  private background: Graphics;
  private playerEntries: Map<string, { container: Container }> = new Map();
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
    equipment?: Record<string, number>;
  }): void {
    this.players.set(info.playerId, {
      playerId: info.playerId,
      displayName: info.displayName,
      x: info.x,
      y: info.y,
      gold: info.gold,
      items: info.items,
      equipment: info.equipment ?? {},
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

    const itemStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 10,
      fill: '#AADDAA',
    });

    let y = PADDING;
    for (const [id, player] of this.players) {
      const entry = new Container();
      entry.y = y;
      entry.x = PADDING;

      // Player name
      const nameText = new Text({ text: player.displayName, style: nameStyle });
      entry.addChild(nameText);

      // Position and gold
      const posGold = `Pos: (${player.x}, ${player.y})  G: ${player.gold}`;
      const infoText = new Text({ text: posGold, style: infoStyle });
      infoText.y = 17;
      entry.addChild(infoText);

      // Items with emojis
      const itemParts: string[] = [];
      for (const item of player.items) {
        const def = ITEMS[item.itemType as keyof typeof ITEMS];
        const emoji = def?.emoji ?? '?';
        itemParts.push(`${emoji}x${item.quantity}`);
      }
      const itemsStr = itemParts.length > 0 ? itemParts.join(' ') : 'none';
      const itemsText = new Text({ text: itemsStr, style: itemStyle });
      itemsText.y = 33;
      entry.addChild(itemsText);

      // Equipment
      const equipParts: string[] = [];
      for (const [slot, tier] of Object.entries(player.equipment)) {
        const emoji = EQUIP_EMOJI[slot] ?? slot;
        equipParts.push(`${emoji}T${tier}`);
      }
      if (equipParts.length > 0) {
        const equipText = new Text({ text: equipParts.join(' '), style: itemStyle });
        equipText.y = 48;
        entry.addChild(equipText);
      }

      this.container.addChild(entry);
      this.playerEntries.set(id, { container: entry });

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
