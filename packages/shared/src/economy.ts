import { PlayerState, ItemType, EquipmentSlot, EquipmentTier } from './types';
import { INVENTORY_UPGRADE_SLOTS, INVENTORY_UPGRADE_PRICES } from './constants';
import { getItemValue } from './items';
import { getEquipmentPrice, getNextTier, canBuyEquipment } from './equipment';
import { getItemCount } from './inventory';
import { getTntGoldPenalty } from './layers';

/**
 * Calculates the total gold value from selling a list of items.
 * Pure function - no side effects.
 *
 * @param items - Array of items with types and quantities to sell
 * @returns Total gold that would be earned from selling these items
 */
export function calculateSellValue(items: { itemType: ItemType; quantity: number }[]): number {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    total += getItemValue(item.itemType) * item.quantity;
  }
  return total;
}

/**
 * Processes a sell transaction for a player.
 * Validates that items exist in inventory before selling.
 * Pure function - does NOT mutate player state, returns new values.
 *
 * @param player - Current player state
 * @param itemsToSell - Array of items to sell, or 'all' to sell everything
 * @returns Transaction result with success status, gold earned, and new gold total
 */
export function processSell(
  player: PlayerState,
  itemsToSell: { itemType: ItemType; quantity: number }[] | 'all'
): {
  success: boolean;
  goldEarned: number;
  itemsSold: { itemType: ItemType; quantity: number; unitPrice: number }[];
  newGold: number;
} {
  // Determine which items to sell
  let items: { itemType: ItemType; quantity: number }[];

  if (itemsToSell === 'all') {
    // Collect all items from inventory
    items = [];
    for (let i = 0; i < player.inventory.length; i++) {
      const slot = player.inventory[i];
      if (slot !== null) {
        items.push({ itemType: slot.itemType, quantity: slot.quantity });
      }
    }
  } else {
    items = itemsToSell;
  }

  // Validate items exist in inventory and calculate values
  const itemsSold: { itemType: ItemType; quantity: number; unitPrice: number }[] = [];
  let goldEarned = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const available = getItemCount(player.inventory, item.itemType);

    // Check if player has enough of this item
    if (available < item.quantity) {
      return {
        success: false,
        goldEarned: 0,
        itemsSold: [],
        newGold: player.gold
      };
    }

    const unitPrice = getItemValue(item.itemType);
    const value = unitPrice * item.quantity;
    goldEarned += value;
    itemsSold.push({
      itemType: item.itemType,
      quantity: item.quantity,
      unitPrice
    });
  }

  return {
    success: true,
    goldEarned,
    itemsSold,
    newGold: player.gold + goldEarned
  };
}

/**
 * Checks if a player can afford a specific equipment tier.
 * Pure function.
 *
 * @param gold - Current gold amount
 * @param slot - Equipment slot
 * @param tier - Equipment tier to check
 * @returns True if player has enough gold
 */
export function canAffordEquipment(
  gold: number,
  slot: EquipmentSlot,
  tier: EquipmentTier
): boolean {
  const price = getEquipmentPrice(slot, tier);
  return gold >= price;
}

/**
 * Processes an equipment purchase for the next tier.
 * Validates tier progression (can't skip tiers) and funds.
 * Pure function - does NOT mutate player state, returns new values.
 *
 * @param player - Current player state
 * @param slot - Equipment slot to upgrade
 * @returns Purchase result with success status, new tier, and new gold total
 */
export function processEquipmentPurchase(
  player: PlayerState,
  slot: EquipmentSlot
): {
  success: boolean;
  reason?: string;
  newTier?: EquipmentTier;
  goldSpent?: number;
  newGold?: number;
} {
  const currentTier = player.equipment[slot];

  // Check if can buy (validates tier progression and gold)
  const canBuyResult = canBuyEquipment(slot, currentTier, player.gold);

  if (!canBuyResult.canBuy) {
    return {
      success: false,
      reason: canBuyResult.reason
    };
  }

  // Get next tier
  const nextTier = getNextTier(currentTier);
  if (nextTier === null) {
    return {
      success: false,
      reason: 'Already at maximum tier'
    };
  }

  const price = getEquipmentPrice(slot, nextTier);

  return {
    success: true,
    newTier: nextTier,
    goldSpent: price,
    newGold: player.gold - price
  };
}

/**
 * Checks if a player can afford the next inventory upgrade.
 * Pure function.
 *
 * @param gold - Current gold amount
 * @param currentLevel - Current inventory upgrade level
 * @returns True if player can afford the next upgrade
 */
export function canAffordInventoryUpgrade(
  gold: number,
  currentLevel: number
): boolean {
  if (currentLevel >= INVENTORY_UPGRADE_PRICES.length - 1) {
    return false; // Already at max level
  }
  const nextLevel = currentLevel + 1;
  const price = INVENTORY_UPGRADE_PRICES[nextLevel];
  return gold >= price;
}

/**
 * Processes an inventory upgrade purchase.
 * Upgrades to the next level, validating funds and max level.
 * Pure function - does NOT mutate player state, returns new values.
 *
 * @param player - Current player state
 * @returns Upgrade result with success status, new slot count, and new gold total
 */
export function processInventoryUpgrade(
  player: PlayerState
): {
  success: boolean;
  reason?: string;
  newSlots?: number;
  newLevel?: number;
  goldSpent?: number;
  newGold?: number;
} {
  const currentLevel = player.inventoryUpgradeLevel;

  // Check if at max level
  if (currentLevel >= INVENTORY_UPGRADE_PRICES.length - 1) {
    return {
      success: false,
      reason: 'Inventory already at maximum capacity'
    };
  }

  const nextLevel = currentLevel + 1;
  const price = INVENTORY_UPGRADE_PRICES[nextLevel];

  // Check if can afford
  if (player.gold < price) {
    return {
      success: false,
      reason: `Need ${price} gold (have ${player.gold})`
    };
  }

  const newSlots = INVENTORY_UPGRADE_SLOTS[nextLevel];

  return {
    success: true,
    newSlots,
    newLevel: nextLevel,
    goldSpent: price,
    newGold: player.gold - price
  };
}

/**
 * Applies TNT explosion gold penalty based on depth/layer.
 * Gold cannot go below 0.
 * Pure function.
 *
 * @param gold - Current gold amount
 * @param depth - Depth where TNT exploded
 * @returns New gold amount and amount lost
 */
export function applyTntPenalty(
  gold: number,
  depth: number
): { newGold: number; goldLost: number } {
  const penalty = getTntGoldPenalty(depth);
  const goldLost = Math.min(gold, penalty); // Can't lose more than you have
  const newGold = Math.max(0, gold - penalty); // Can't go below 0

  return {
    newGold,
    goldLost
  };
}

/**
 * Calculates the total value of all equipment owned by a player.
 * Useful for leaderboards and stats.
 * Pure function.
 *
 * @param equipment - Player's current equipment
 * @returns Total gold value of all equipment
 */
export function calculateEquipmentValue(equipment: Record<EquipmentSlot, EquipmentTier>): number {
  let total = 0;
  const slots = Object.keys(equipment) as EquipmentSlot[];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const tier = equipment[slot];
    total += getEquipmentPrice(slot, tier);
  }
  return total;
}

/**
 * Calculates a player's total net worth (gold + inventory + equipment).
 * Useful for leaderboards and progression tracking.
 * Pure function.
 *
 * @param player - Player state
 * @returns Total net worth in gold
 */
export function calculateNetWorth(player: PlayerState): number {
  let worth = player.gold;

  // Add inventory value
  for (let i = 0; i < player.inventory.length; i++) {
    const slot = player.inventory[i];
    if (slot !== null) {
      worth += getItemValue(slot.itemType) * slot.quantity;
    }
  }

  // Add equipment value
  worth += calculateEquipmentValue(player.equipment);

  return worth;
}

/**
 * Validates if a purchase transaction would be valid.
 * Generic validation for any gold-based purchase.
 * Pure function.
 *
 * @param currentGold - Player's current gold
 * @param price - Price of item to purchase
 * @param allowZero - Whether to allow gold to reach exactly 0
 * @returns Validation result with success and optional reason
 */
export function validatePurchase(
  currentGold: number,
  price: number,
  allowZero: boolean = true
): { valid: boolean; reason?: string } {
  if (price < 0) {
    return { valid: false, reason: 'Invalid price' };
  }

  if (currentGold < price) {
    return { valid: false, reason: `Insufficient funds (need ${price}g, have ${currentGold}g)` };
  }

  if (!allowZero && currentGold === price) {
    return { valid: false, reason: 'Cannot spend all gold' };
  }

  return { valid: true };
}
