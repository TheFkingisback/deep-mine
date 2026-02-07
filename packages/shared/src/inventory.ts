import { InventorySlot, ItemType, EquipmentTier } from './types';
import { MAX_STACK_SIZE } from './constants';
import { getItemValue } from './items';
import { getVestBonusSlots } from './equipment';

/**
 * Creates a new empty inventory with the specified number of slots.
 * All slots are initialized to null.
 *
 * @param slots - Number of inventory slots to create
 * @returns Array of null inventory slots
 */
export function createInventory(slots: number): (InventorySlot | null)[] {
  const inventory: (InventorySlot | null)[] = [];
  for (let i = 0; i < slots; i++) {
    inventory.push(null);
  }
  return inventory;
}

/**
 * Calculates the total effective slot count including vest bonuses.
 * Base slots come from inventory upgrades, vest adds bonus slots.
 *
 * @param baseSlots - Base inventory slots (from upgrade level)
 * @param vestTier - Current vest equipment tier (1-7)
 * @returns Total usable inventory slots
 */
export function getEffectiveSlotCount(baseSlots: number, vestTier: EquipmentTier): number {
  return baseSlots + getVestBonusSlots(vestTier);
}

/**
 * Attempts to add items to inventory with intelligent stacking.
 * First fills existing stacks of the same item type (up to MAX_STACK_SIZE),
 * then uses empty slots. Returns overflow if inventory is full.
 *
 * @param inventory - Current inventory state
 * @param itemType - Type of item to add
 * @param quantity - Number of items to add
 * @returns Object with success boolean and overflow count
 */
export function addItem(
  inventory: (InventorySlot | null)[],
  itemType: ItemType,
  quantity: number
): { success: boolean; overflow: number } {
  let remaining = quantity;

  // First pass: fill existing stacks of same type
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (slot !== null && slot.itemType === itemType) {
      const canAdd = Math.min(remaining, MAX_STACK_SIZE - slot.quantity);
      slot.quantity += canAdd;
      remaining -= canAdd;
      if (remaining === 0) {
        return { success: true, overflow: 0 };
      }
    }
  }

  // Second pass: use empty slots
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i] === null) {
      const stackSize = Math.min(remaining, MAX_STACK_SIZE);
      inventory[i] = {
        itemType,
        quantity: stackSize
      };
      remaining -= stackSize;
      if (remaining === 0) {
        return { success: true, overflow: 0 };
      }
    }
  }

  // If we get here, there's overflow
  return { success: false, overflow: remaining };
}

/**
 * Removes items from inventory, starting from the last slot.
 * If insufficient items exist, removes as many as possible.
 *
 * @param inventory - Current inventory state
 * @param itemType - Type of item to remove
 * @param quantity - Number of items to remove
 * @returns Object with success boolean and actual removed count
 */
export function removeItem(
  inventory: (InventorySlot | null)[],
  itemType: ItemType,
  quantity: number
): { success: boolean; removed: number } {
  const totalAvailable = getItemCount(inventory, itemType);
  const toRemove = Math.min(quantity, totalAvailable);
  let remaining = toRemove;

  // Remove from last slot first (reverse iteration)
  for (let i = inventory.length - 1; i >= 0 && remaining > 0; i--) {
    const slot = inventory[i];
    if (slot !== null && slot.itemType === itemType) {
      const removeFromSlot = Math.min(remaining, slot.quantity);
      slot.quantity -= removeFromSlot;
      remaining -= removeFromSlot;

      // Clear slot if empty
      if (slot.quantity === 0) {
        inventory[i] = null;
      }
    }
  }

  return {
    success: toRemove === quantity,
    removed: toRemove
  };
}

/**
 * Counts the total quantity of a specific item type in inventory.
 * Sums across all slots containing this item.
 *
 * @param inventory - Current inventory state
 * @param itemType - Type of item to count
 * @returns Total quantity of this item in inventory
 */
export function getItemCount(inventory: (InventorySlot | null)[], itemType: ItemType): number {
  let count = 0;
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (slot !== null && slot.itemType === itemType) {
      count += slot.quantity;
    }
  }
  return count;
}

/**
 * Counts how many inventory slots currently contain items.
 *
 * @param inventory - Current inventory state
 * @returns Number of non-null slots
 */
export function getUsedSlots(inventory: (InventorySlot | null)[]): number {
  let used = 0;
  for (let i = 0; i < inventory.length; i++) {
    if (inventory[i] !== null) {
      used++;
    }
  }
  return used;
}

/**
 * Checks if the inventory is full based on effective slot count.
 * Inventory array length = base slots, vest tier adds bonus slots.
 * Full when used slots >= (base slots + vest bonus).
 *
 * @param inventory - Current inventory state
 * @param vestTier - Current vest equipment tier
 * @returns True if inventory is at capacity
 */
export function isFull(inventory: (InventorySlot | null)[], vestTier: EquipmentTier): boolean {
  const effectiveSlots = getEffectiveSlotCount(inventory.length, vestTier);
  const usedSlots = getUsedSlots(inventory);
  return usedSlots >= effectiveSlots;
}

/**
 * Calculates the total gold value of all items in inventory.
 * Useful for stats display and determining lost value on death.
 *
 * @param inventory - Current inventory state
 * @returns Total sell value in gold
 */
export function getTotalValue(inventory: (InventorySlot | null)[]): number {
  let total = 0;
  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (slot !== null) {
      total += getItemValue(slot.itemType) * slot.quantity;
    }
  }
  return total;
}

/**
 * Empties all items from inventory.
 * Sets all slots to null.
 *
 * @param inventory - Current inventory state
 * @returns The cleared inventory (same reference, modified in place)
 */
export function clearInventory(inventory: (InventorySlot | null)[]): (InventorySlot | null)[] {
  for (let i = 0; i < inventory.length; i++) {
    inventory[i] = null;
  }
  return inventory;
}

/**
 * Removes random items from inventory for negative events (e.g., cave-in).
 * Removes one item at a time from random occupied slots.
 *
 * @param inventory - Current inventory state
 * @param count - Number of individual items to remove
 * @param rng - Random number generator function [0, 1)
 * @returns Array of item types that were removed
 */
export function removeRandomItems(
  inventory: (InventorySlot | null)[],
  count: number,
  rng: () => number
): ItemType[] {
  const removed: ItemType[] = [];

  // Build list of non-empty slot indices
  const getNonEmptyIndices = (): number[] => {
    const indices: number[] = [];
    for (let i = 0; i < inventory.length; i++) {
      if (inventory[i] !== null) {
        indices.push(i);
      }
    }
    return indices;
  };

  // Remove 'count' random items
  for (let i = 0; i < count; i++) {
    const nonEmptyIndices = getNonEmptyIndices();
    if (nonEmptyIndices.length === 0) {
      break; // No more items to remove
    }

    // Pick random slot
    const randomIndex = Math.floor(rng() * nonEmptyIndices.length);
    const slotIndex = nonEmptyIndices[randomIndex];
    const slot = inventory[slotIndex];

    if (slot !== null) {
      // Remove one item from this slot
      removed.push(slot.itemType);
      slot.quantity--;

      // If slot is now empty, clear it
      if (slot.quantity === 0) {
        inventory[slotIndex] = null;
      }
    }
  }

  return removed;
}

/**
 * Compacts inventory by consolidating stacks of the same item type.
 * Combines partial stacks to minimize slot usage.
 * Useful after many additions/removals that leave fragmented stacks.
 *
 * @param inventory - Current inventory state
 */
export function compactInventory(inventory: (InventorySlot | null)[]): void {
  // Collect all items by type
  const itemCounts: Record<string, number> = {};

  for (let i = 0; i < inventory.length; i++) {
    const slot = inventory[i];
    if (slot !== null) {
      const current = itemCounts[slot.itemType] || 0;
      itemCounts[slot.itemType] = current + slot.quantity;
      inventory[i] = null; // Clear slot
    }
  }

  // Re-add items optimally
  let slotIndex = 0;
  const itemTypes = Object.keys(itemCounts) as ItemType[];
  for (let i = 0; i < itemTypes.length; i++) {
    const itemType = itemTypes[i];
    const totalQuantity = itemCounts[itemType];
    let remaining = totalQuantity;
    while (remaining > 0 && slotIndex < inventory.length) {
      const stackSize = Math.min(remaining, MAX_STACK_SIZE);
      inventory[slotIndex] = {
        itemType,
        quantity: stackSize
      };
      remaining -= stackSize;
      slotIndex++;
    }
  }
}

/**
 * Checks if inventory has space for a specific quantity of items.
 * Considers existing stacks that can be topped up.
 *
 * @param inventory - Current inventory state
 * @param itemType - Type of item to check
 * @param quantity - Quantity to check for
 * @param vestTier - Current vest tier (for effective slot count)
 * @returns True if the items would fit
 */
export function hasSpaceFor(
  inventory: (InventorySlot | null)[],
  itemType: ItemType,
  quantity: number,
  vestTier: EquipmentTier
): boolean {
  let remaining = quantity;
  const effectiveSlots = getEffectiveSlotCount(inventory.length, vestTier);

  // Check existing stacks
  for (let i = 0; i < effectiveSlots; i++) {
    const slot = inventory[i];
    if (slot !== null && slot.itemType === itemType) {
      const canAdd = MAX_STACK_SIZE - slot.quantity;
      remaining -= canAdd;
      if (remaining <= 0) return true;
    }
  }

  // Check empty slots
  let emptySlots = 0;
  for (let i = 0; i < effectiveSlots; i++) {
    if (inventory[i] === null) {
      emptySlots++;
    }
  }

  const neededSlots = Math.ceil(remaining / MAX_STACK_SIZE);
  return emptySlots >= neededSlots;
}
