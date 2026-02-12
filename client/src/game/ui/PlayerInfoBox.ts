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
const MAX_SLOTS = 8;

/**
 * Panel at top-right showing all players in the match.
 * Uses persistent pre-allocated elements — never destroy/recreate,
 * just update .text and .visible to avoid PixiJS v8 rendering issues.
 */
export class PlayerInfoBox {
  private parentContainer: Container;
  private bg: Graphics;
  private slots: { name: Text; info: Text }[] = [];
  private players: Map<string, PlayerInfo> = new Map();
  private selfPlayerId: string;
  private panelX: number;
  private readonly panelY = 10;

  constructor(parentContainer: Container, screenWidth: number, selfPlayerId = '') {
    this.selfPlayerId = selfPlayerId;
    this.parentContainer = parentContainer;
    this.panelX = screenWidth - PANEL_WIDTH - 10;

    // Persistent background
    this.bg = new Graphics();
    this.bg.x = this.panelX;
    this.bg.y = this.panelY;
    this.parentContainer.addChild(this.bg);

    // Pre-allocate text slots (created once, never destroyed until cleanup)
    for (let i = 0; i < MAX_SLOTS; i++) {
      const name = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: 'Arial, sans-serif',
          fontSize: 13,
          fontWeight: 'bold',
          fill: '#F0A500',
        }),
      });
      name.x = this.panelX + PADDING;
      name.y = this.panelY + PADDING + i * ENTRY_HEIGHT;
      name.visible = false;
      this.parentContainer.addChild(name);

      const info = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: 'Arial, sans-serif',
          fontSize: 10,
          fill: '#CCCCEE',
          lineHeight: 15,
        }),
      });
      info.x = this.panelX + PADDING;
      info.y = this.panelY + PADDING + 18 + i * ENTRY_HEIGHT;
      info.visible = false;
      this.parentContainer.addChild(info);

      this.slots.push({ name, info });
    }
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
    const sorted = this.getSortedPlayers();

    // Update background
    this.bg.clear();
    if (sorted.length > 0) {
      const height = sorted.length * ENTRY_HEIGHT + PADDING * 2;
      this.bg.roundRect(0, 0, PANEL_WIDTH, height, 6);
      this.bg.fill({ color: 0x000000, alpha: 0.6 });
      this.bg.roundRect(0, 0, PANEL_WIDTH, height, 6);
      this.bg.stroke({ color: 0xf0a500, width: 1, alpha: 0.4 });
    }

    // Update pre-allocated slots (no create/destroy)
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = this.slots[i];
      if (i < sorted.length) {
        const player = sorted[i];
        const isSelf = player.playerId === this.selfPlayerId;

        const nameLabel = isSelf ? `${player.displayName} (YOU)` : player.displayName;
        slot.name.text = nameLabel;
        slot.name.style.fill = isSelf ? '#55FF55' : '#F0A500';
        slot.name.visible = true;

        slot.info.text = this.formatPlayerText(player);
        slot.info.style.fill = isSelf ? '#CCDDCC' : '#CCCCEE';
        slot.info.visible = true;
      } else {
        slot.name.visible = false;
        slot.info.visible = false;
      }
    }
  }

  destroy(): void {
    if (this.bg.parent) this.bg.parent.removeChild(this.bg);
    this.bg.destroy();
    for (const slot of this.slots) {
      if (slot.name.parent) slot.name.parent.removeChild(slot.name);
      slot.name.destroy();
      if (slot.info.parent) slot.info.parent.removeChild(slot.info);
      slot.info.destroy();
    }
    this.slots = [];
  }
}
