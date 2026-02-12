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
const ENTRY_HEIGHT = 80;
const PADDING = 8;

/**
 * Panel at top-right showing all players in the match.
 * Renders elements directly on parentContainer (no wrapper Container)
 * to work around PixiJS v8 container rendering issues.
 */
export class PlayerInfoBox {
  private parentContainer: Container;
  private elements: (Graphics | Text)[] = [];
  private players: Map<string, PlayerInfo> = new Map();
  private selfPlayerId: string;
  private panelX: number;
  private readonly panelY = 10;

  constructor(parentContainer: Container, screenWidth: number, selfPlayerId = '') {
    this.selfPlayerId = selfPlayerId;
    this.parentContainer = parentContainer;
    this.panelX = screenWidth - PANEL_WIDTH - 10;
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

  private formatPlayerText(player: PlayerInfo): string {
    const ix = Math.floor(player.x);
    const iy = Math.floor(player.y);
    const posStr = iy <= 1 ? 'Surface' : `(${ix},${iy})`;
    const hearts = '\u2764\uFE0F'.repeat(Math.max(0, player.lives));

    let text = `${posStr}  G:${player.gold}  ${hearts}`;

    // Items
    const itemParts: string[] = [];
    for (const item of player.items) {
      const def = ITEMS[item.itemType as keyof typeof ITEMS];
      const emoji = def?.emoji ?? '?';
      itemParts.push(`${emoji}x${item.quantity}`);
    }
    if (itemParts.length > 0) {
      text += `\n${itemParts.join(' ')}`;
    }

    // Equipment
    const equipOrder = [EquipmentSlot.SHOVEL, EquipmentSlot.HELMET, EquipmentSlot.VEST, EquipmentSlot.TORCH, EquipmentSlot.ROPE];
    const equipParts: string[] = [];
    for (const slot of equipOrder) {
      const tier = player.equipment[slot] ?? 1;
      const emoji = EQUIP_EMOJIS[slot] ?? '?';
      equipParts.push(`${emoji}T${tier}`);
    }
    text += `\n${equipParts.join(' ')}`;

    return text;
  }

  private refresh(): void {
    // Remove all old elements from parent
    for (const el of this.elements) {
      if (el.parent) el.parent.removeChild(el);
      el.destroy();
    }
    this.elements = [];

    const sorted = this.getSortedPlayers();
    if (sorted.length === 0) return;

    // Background — added directly to parentContainer
    const height = Math.max(40, sorted.length * ENTRY_HEIGHT + PADDING * 2);
    const bg = new Graphics();
    bg.roundRect(0, 0, PANEL_WIDTH, height, 6);
    bg.fill({ color: 0x000000, alpha: 0.6 });
    bg.roundRect(0, 0, PANEL_WIDTH, height, 6);
    bg.stroke({ color: 0xf0a500, width: 1, alpha: 0.4 });
    bg.x = this.panelX;
    bg.y = this.panelY;
    this.parentContainer.addChild(bg);
    this.elements.push(bg);

    // Player entries
    let y = this.panelY + PADDING;
    for (const player of sorted) {
      const isSelf = player.playerId === this.selfPlayerId;

      // Player name
      const nameLabel = isSelf ? `${player.displayName} (YOU)` : player.displayName;
      const nameText = new Text({
        text: nameLabel,
        style: new TextStyle({
          fontFamily: 'Arial, sans-serif',
          fontSize: 13,
          fontWeight: 'bold',
          fill: isSelf ? '#55FF55' : '#F0A500',
        }),
      });
      nameText.x = this.panelX + PADDING;
      nameText.y = y;
      this.parentContainer.addChild(nameText);
      this.elements.push(nameText);

      // Info (position, gold, lives, items, equipment)
      const infoStr = this.formatPlayerText(player);
      const infoText = new Text({
        text: infoStr,
        style: new TextStyle({
          fontFamily: 'Arial, sans-serif',
          fontSize: 10,
          fill: isSelf ? '#CCDDCC' : '#CCCCEE',
          lineHeight: 15,
        }),
      });
      infoText.x = this.panelX + PADDING;
      infoText.y = y + 18;
      this.parentContainer.addChild(infoText);
      this.elements.push(infoText);

      y += ENTRY_HEIGHT;
    }
  }

  destroy(): void {
    for (const el of this.elements) {
      if (el.parent) el.parent.removeChild(el);
      el.destroy();
    }
    this.elements = [];
  }
}
