import { PlayerState, EquipmentSlot, EquipmentTier, ItemType } from '@shared/types';
import {
  canAffordEquipment,
  processEquipmentPurchase,
  canAffordInventoryUpgrade,
  processInventoryUpgrade,
  processSell,
} from '@shared/economy';
import { getEffectiveSlotCount } from '@shared/inventory';
import {
  ServerMessage,
  SellResultMessage,
  BuyResultMessage,
} from '../types.js';

export class EconomyManager {
  processSellRequest(
    player: PlayerState,
    items: { itemType: ItemType; quantity: number }[]
  ): { messages: ServerMessage[]; success: boolean } {
    const messages: ServerMessage[] = [];

    // Process the sale using shared economy logic
    const sellResult = processSell(player, items);

    if (!sellResult.success) {
      messages.push({
        type: 'error',
        code: 'SELL_FAILED',
        message: 'Could not sell items - insufficient quantity',
      });
      return { messages, success: false };
    }

    // Apply gold change to player state
    player.gold = sellResult.newGold;

    // Clear sold items from inventory
    for (const sold of sellResult.itemsSold) {
      let remaining = sold.quantity;
      for (let i = 0; i < player.inventory.length && remaining > 0; i++) {
        const slot = player.inventory[i];
        if (slot && slot.itemType === sold.itemType) {
          const remove = Math.min(slot.quantity, remaining);
          slot.quantity -= remove;
          remaining -= remove;
          if (slot.quantity <= 0) {
            player.inventory[i] = null;
          }
        }
      }
    }

    const resultMsg: SellResultMessage = {
      type: 'sell_result',
      itemsSold: sellResult.itemsSold.map(s => ({
        ...s,
        total: s.unitPrice * s.quantity,
      })),
      totalGoldEarned: sellResult.goldEarned,
      newGoldBalance: player.gold,
    };

    messages.push(resultMsg);
    return { messages, success: true };
  }

  processEquipmentBuyRequest(
    player: PlayerState,
    slot: EquipmentSlot,
    _tier: EquipmentTier
  ): { messages: ServerMessage[]; success: boolean } {
    const messages: ServerMessage[] = [];

    // processEquipmentPurchase validates tier progression and gold
    const purchase = processEquipmentPurchase(player, slot);

    if (!purchase.success) {
      const resultMsg: BuyResultMessage = {
        type: 'buy_result',
        success: false,
        goldSpent: 0,
        newGoldBalance: player.gold,
        error: purchase.reason ?? 'Purchase failed',
      };
      messages.push(resultMsg);
      return { messages, success: false };
    }

    // Apply changes to player state
    if (purchase.newTier) {
      player.equipment[slot] = purchase.newTier;
    }
    if (purchase.newGold !== undefined) {
      player.gold = purchase.newGold;
    }

    const resultMsg: BuyResultMessage = {
      type: 'buy_result',
      success: true,
      slot,
      newTier: purchase.newTier,
      goldSpent: purchase.goldSpent ?? 0,
      newGoldBalance: player.gold,
    };

    messages.push(resultMsg);
    return { messages, success: true };
  }

  processInventoryUpgradeRequest(
    player: PlayerState
  ): { messages: ServerMessage[]; success: boolean } {
    const messages: ServerMessage[] = [];

    const result = processInventoryUpgrade(player);

    if (!result.success) {
      const resultMsg: BuyResultMessage = {
        type: 'buy_result',
        success: false,
        goldSpent: 0,
        newGoldBalance: player.gold,
        error: result.reason ?? 'Upgrade failed',
      };
      messages.push(resultMsg);
      return { messages, success: false };
    }

    // Apply changes to player state
    if (result.newLevel !== undefined) {
      player.inventoryUpgradeLevel = result.newLevel;
    }
    if (result.newGold !== undefined) {
      player.gold = result.newGold;
    }
    if (result.newSlots !== undefined) {
      player.maxInventorySlots = result.newSlots;
    }

    const resultMsg: BuyResultMessage = {
      type: 'buy_result',
      success: true,
      goldSpent: result.goldSpent ?? 0,
      newGoldBalance: player.gold,
    };

    messages.push(resultMsg);
    return { messages, success: true };
  }

  getPlayerEconomyState(player: PlayerState): {
    gold: number;
    inventorySlots: number;
    inventoryLevel: number;
  } {
    return {
      gold: player.gold,
      inventorySlots: getEffectiveSlotCount(
        player.maxInventorySlots,
        player.equipment.vest as EquipmentTier
      ),
      inventoryLevel: player.inventoryUpgradeLevel,
    };
  }
}
