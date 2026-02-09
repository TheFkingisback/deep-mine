import { ItemType, PlayerState, InventorySlot, EquipmentSlot, EquipmentTier } from '@shared/types';
import { addItem, isFull } from '@shared/inventory';
import { ServerMessage, CollectResultMessage, InventoryFullMessage } from '../types.js';

interface DroppedItem {
  itemId: string;
  itemType: ItemType;
  x: number;
  y: number;
  spawnedAt: number;
  collectedBy: string | null;
}

/**
 * Manages item drops and collection conflicts.
 * First player to collect wins. Losers see "Too slow!" message.
 */
export class ItemCollector {
  private drops = new Map<string, DroppedItem>();
  private dropTtl = 60000; // Items despawn after 60s

  addDrop(itemId: string, itemType: ItemType, x: number, y: number): void {
    this.drops.set(itemId, {
      itemId,
      itemType,
      x,
      y,
      spawnedAt: Date.now(),
      collectedBy: null,
    });
  }

  collectItem(
    playerId: string,
    itemId: string,
    playerState: PlayerState
  ): { messages: ServerMessage[]; broadcastMessages: ServerMessage[]; success: boolean } {
    const messages: ServerMessage[] = [];
    const broadcastMessages: ServerMessage[] = [];

    const drop = this.drops.get(itemId);

    if (!drop) {
      const result: CollectResultMessage = {
        type: 'collect_result',
        success: false,
        itemId,
        error: 'Item not found',
      };
      messages.push(result);
      return { messages, broadcastMessages, success: false };
    }

    if (drop.collectedBy !== null) {
      // Already collected by someone else
      const result: CollectResultMessage = {
        type: 'collect_result',
        success: false,
        itemId,
        error: 'Too slow!',
      };
      messages.push(result);
      return { messages, broadcastMessages, success: false };
    }

    // Check if inventory is full
    const vestTier = (playerState.equipment[EquipmentSlot.VEST] ?? 0) as EquipmentTier;
    if (isFull(playerState.inventory, vestTier)) {
      const fullMsg: InventoryFullMessage = {
        type: 'inventory_full',
        itemType: drop.itemType,
      };
      messages.push(fullMsg);
      return { messages, broadcastMessages, success: false };
    }

    // Collect the item
    drop.collectedBy = playerId;
    addItem(playerState.inventory, drop.itemType, 1);

    const result: CollectResultMessage = {
      type: 'collect_result',
      success: true,
      itemId,
      itemType: drop.itemType,
      quantity: 1,
    };
    messages.push(result);

    // Remove the drop
    this.drops.delete(itemId);

    return { messages, broadcastMessages, success: true };
  }

  /**
   * Clean up expired drops.
   */
  cleanupExpiredDrops(): void {
    const now = Date.now();
    for (const [id, drop] of this.drops) {
      if (now - drop.spawnedAt > this.dropTtl) {
        this.drops.delete(id);
      }
    }
  }

  getDropCount(): number {
    return this.drops.size;
  }

  destroy(): void {
    this.drops.clear();
  }
}
