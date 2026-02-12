import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { ITEMS } from '@shared/items';
import { EquipmentSlot } from '@shared/types';

interface PlayerInfo {
  playerId: string;
  displayName: string;
  x: number;
  y: number;
  gold: number;
  lives: number;
  items: { itemType: string; quantity: number }[];
  equipment: Record<string, number>;
}

const EQUIP_EMOJIS: Record<string, string> = {
  [EquipmentSlot.SHOVEL]: '\u26CF\uFE0F',
  [EquipmentSlot.HELMET]: '\u26D1\uFE0F',
  [EquipmentSlot.VEST]: '\uD83E\uDDBA',
  [EquipmentSlot.TORCH]: '\uD83D\uDD26',
  [EquipmentSlot.ROPE]: '\uD83E\uDE62',
};

const PANEL_WIDTH = 240;
const LINE_HEIGHT = 82;
const PADDING = 8;

/**
 * Semi-transparent panel at top-right showing all players in the match.
 * Shows: name, gold, lives, collected items with emojis.
 * Self player listed first, then opponents sorted by gold (descending).
 */
export class PlayerInfoBox {
  private container: Container;
  private background: Graphics;
  private playerEntries: Map<string, { container: Container }> = new Map();
  private players: Map<string, PlayerInfo> = new Map();
  private selfPlayerId: string;

  constructor(parentContainer: Container, screenWidth: number, selfPlayerId = '') {
    this.selfPlayerId = selfPlayerId;
    this.container = new Container();
    this.container.x = screenWidth - PANEL_WIDTH - 10;
    this.container.y = 10;

    this.background = new Graphics();
    this.container.addChild(this.background);

    parentContainer.addChild(this.container);
    this.redrawBackground();
  }

  setSelfPlayerId(id: string): void {
    this.selfPlayerId = id;
  }

  updatePlayer(info: {
    playerId: string;
    displayName: string;
    x: number;
    y: number;
    gold: number;
    lives?: number;
    items: { itemType: string; quantity: number }[];
    equipment?: Record<string, number>;
  }): void {
    this.players.set(info.playerId, {
      playerId: info.playerId,
      displayName: info.displayName,
      x: info.x,
      y: info.y,
      gold: info.gold,
      lives: info.lives ?? 2,
      items: info.items,
      equipment: info.equipment ?? {},
    });
    this.refresh();
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.refresh();
  }

  private getSortedPlayers(): PlayerInfo[] {
    const all = [...this.players.values()];
    const self = all.filter(p => p.playerId === this.selfPlayerId);
    const others = all
      .filter(p => p.playerId !== this.selfPlayerId)
      .sort((a, b) => b.gold - a.gold);
    return [...self, ...others];
  }

  private refresh(): void {
    // Remove old entries
    for (const [, entry] of this.playerEntries) {
      this.container.removeChild(entry.container);
      entry.container.destroy({ children: true });
    }
    this.playerEntries.clear();

    const sorted = this.getSortedPlayers();
    console.log(`[PlayerInfoBox] refresh: ${this.players.size} players in map, ${sorted.length} sorted, selfId=${this.selfPlayerId.slice(0, 8)}, ids=[${sorted.map(p => p.playerId.slice(0, 8)).join(',')}]`);

    let y = PADDING;
    for (const player of sorted) {
      const isSelf = player.playerId === this.selfPlayerId;
      const entry = new Container();
      entry.y = y;
      entry.x = PADDING;

      // Player name (highlight self)
      const nameStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: isSelf ? '#55FF55' : '#F0A500',
      });
      const nameLabel = isSelf ? `${player.displayName} (YOU)` : player.displayName;
      const nameText = new Text({ text: nameLabel, style: nameStyle });
      entry.addChild(nameText);

      // Position + Gold + Lives
      const ix = Math.floor(player.x);
      const iy = Math.floor(player.y);
      const posStr = iy <= 1 ? 'Surface' : `(${ix},${iy})`;
      const hearts = '\u2764\uFE0F'.repeat(Math.max(0, player.lives));
      const infoStr = `${posStr}  G:${player.gold}  ${hearts}`;
      const infoStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 11,
        fill: '#CCCCEE',
      });
      const infoText = new Text({ text: infoStr, style: infoStyle });
      infoText.y = 17;
      entry.addChild(infoText);

      // Items with emojis
      const itemParts: string[] = [];
      for (const item of player.items) {
        const def = ITEMS[item.itemType as keyof typeof ITEMS];
        const emoji = def?.emoji ?? '?';
        itemParts.push(`${emoji}x${item.quantity}`);
      }
      if (itemParts.length > 0) {
        const itemStyle = new TextStyle({
          fontFamily: 'Arial, sans-serif',
          fontSize: 10,
          fill: '#AADDAA',
        });
        const itemsText = new Text({ text: itemParts.join(' '), style: itemStyle });
        itemsText.y = 33;
        entry.addChild(itemsText);
      }

      // Equipment with emojis
      const equipOrder = [EquipmentSlot.SHOVEL, EquipmentSlot.HELMET, EquipmentSlot.VEST, EquipmentSlot.TORCH, EquipmentSlot.ROPE];
      const equipParts: string[] = [];
      for (const slot of equipOrder) {
        const tier = player.equipment[slot] ?? 1;
        const emoji = EQUIP_EMOJIS[slot] ?? '?';
        equipParts.push(`${emoji}T${tier}`);
      }
      const equipStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 10,
        fill: '#AADDFF',
      });
      const equipText = new Text({ text: equipParts.join(' '), style: equipStyle });
      equipText.y = itemParts.length > 0 ? 48 : 33;
      entry.addChild(equipText);

      this.container.addChild(entry);
      this.playerEntries.set(player.playerId, { container: entry });
      console.log(`[PlayerInfoBox] Created entry for ${player.displayName} (${player.playerId.slice(0, 8)}) at y=${y}, isSelf=${isSelf}`);

      y += LINE_HEIGHT;
    }

    console.log(`[PlayerInfoBox] After refresh: ${this.playerEntries.size} entries, container children=${this.container.children.length}`);
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
