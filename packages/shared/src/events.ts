import { RandomEvent, PlayerState, EquipmentSlot, EquipmentTier, Position, ItemType } from './types';
import {
  GAS_POCKET_DURATION,
  CAVE_IN_PUSH_DISTANCE,
  CAVE_IN_ITEMS_LOST,
  ROCK_SLIDE_HARDNESS_BONUS,
  ROCK_SLIDE_DURATION_BLOCKS
} from './constants';
import { rollLootDrop, getLayerAtDepth } from './layers';
import { removeRandomItems } from './inventory';
import { getVestProtection } from './equipment';

/**
 * Complete registry of all random events that can occur during mining.
 * Events are rolled per block dug and can dramatically alter gameplay.
 */
const EVENTS: Record<string, RandomEvent> = {
  CAVE_IN: {
    type: 'cave_in',
    displayName: 'Cave-In!',
    description: 'Unstable rocks collapse! Player pushed upward, items lost.',
    isPositive: false,
    triggerChance: 0.02
  },
  GAS_POCKET: {
    type: 'gas_pocket',
    displayName: 'Gas Pocket',
    description: 'Toxic gas extinguishes your torch temporarily! TNT becomes invisible.',
    isPositive: false,
    triggerChance: 0.015
  },
  UNDERGROUND_SPRING: {
    type: 'underground_spring',
    displayName: 'Underground Spring',
    description: 'Fresh water reveals hidden treasures nearby!',
    isPositive: true,
    triggerChance: 0.01
  },
  TREASURE_CHEST: {
    type: 'treasure_chest',
    displayName: 'Treasure Chest',
    description: 'An ancient chest filled with rare loot!',
    isPositive: true,
    triggerChance: 0.008
  },
  ROCK_SLIDE: {
    type: 'rock_slide',
    displayName: 'Rock Slide',
    description: 'Debris makes digging harder for a while.',
    isPositive: false,
    triggerChance: 0.012
  }
};

/**
 * Event priority order for when multiple events trigger simultaneously.
 * Higher priority events (earlier in array) override lower priority ones.
 */
const EVENT_PRIORITY: Array<'treasure_chest' | 'underground_spring' | 'cave_in' | 'gas_pocket' | 'rock_slide'> = [
  'treasure_chest',
  'underground_spring',
  'cave_in',
  'gas_pocket',
  'rock_slide'
];

/**
 * Rolls for a random event at a given depth.
 * If multiple events trigger, returns the highest priority one.
 * Returns null if no event triggers.
 *
 * @param depth - Y coordinate where block was broken
 * @param rng - Random number generator function [0, 1)
 * @returns The triggered event, or null if no event occurs
 */
export function rollEvent(depth: number, rng: () => number): RandomEvent | null {
  const triggeredEvents: RandomEvent[] = [];

  // Roll for each event
  for (let i = 0; i < EVENT_PRIORITY.length; i++) {
    const eventType = EVENT_PRIORITY[i];
    const event = EVENTS[eventType.toUpperCase()];
    if (rng() < event.triggerChance) {
      triggeredEvents.push(event);
    }
  }

  // Return highest priority event if any triggered
  if (triggeredEvents.length === 0) {
    return null;
  }

  // Find highest priority event from triggered ones
  for (let i = 0; i < EVENT_PRIORITY.length; i++) {
    const priorityType = EVENT_PRIORITY[i];
    for (let j = 0; j < triggeredEvents.length; j++) {
      if (triggeredEvents[j].type === priorityType) {
        return triggeredEvents[j];
      }
    }
  }

  // Fallback (should never reach)
  return triggeredEvents[0];
}

/**
 * Checks if an event should be blocked by player equipment.
 * Protection logic:
 * - CAVE_IN: Roll vest protection % (e.g., 50% vest = 50% chance to block)
 * - GAS_POCKET: Torch tier 4+ blocks completely
 * - ROCK_SLIDE: Helmet tier 4+ blocks completely
 * - UNDERGROUND_SPRING: Never blocked (always positive)
 * - TREASURE_CHEST: Never blocked (always positive)
 *
 * @param event - The event to check
 * @param equipment - Player's current equipment
 * @param rng - Random number generator function [0, 1)
 * @returns True if event should be blocked (not applied)
 */
export function shouldEventBeBlocked(
  event: RandomEvent,
  equipment: Record<EquipmentSlot, EquipmentTier>,
  rng: () => number
): boolean {
  if (event.type === 'cave_in') {
    // Vest protection: roll against protection percentage
    const vestTier = equipment[EquipmentSlot.VEST];
    const protectionPercent = getVestProtection(vestTier);
    return rng() < (protectionPercent / 100);
  }

  if (event.type === 'gas_pocket') {
    // Torch tier 4+ is immune to gas
    const torchTier = equipment[EquipmentSlot.TORCH];
    return torchTier >= 4;
  }

  if (event.type === 'rock_slide') {
    // Helmet tier 4+ prevents rock slides
    const helmetTier = equipment[EquipmentSlot.HELMET];
    return helmetTier >= 4;
  }

  // Positive events are never blocked
  return false;
}

/**
 * Applies an event's effects to the player and world.
 * Mutates the player's inventory for item loss/gain.
 * Returns metadata about what happened for client visualization.
 *
 * IMPORTANT: This function may mutate player.inventory for item operations.
 *
 * @param event - The event to apply
 * @param player - Current player state (may be mutated)
 * @param depth - Y coordinate where event occurred
 * @param rng - Random number generator function [0, 1)
 * @returns Event result with type, blocked status, and specific effects
 */
export function applyEvent(
  event: RandomEvent,
  player: PlayerState,
  depth: number,
  rng: () => number
): {
  type: string;
  blocked: boolean;
  effects: {
    pushDistance?: number;
    itemsLost?: ItemType[];
    bonusItems?: { itemType: ItemType; position: Position }[];
    hardnessBonus?: number;
    hardnessDuration?: number;
    torchBlackoutDuration?: number;
    playerNewY?: number;
  };
} {
  // Check if event is blocked by equipment
  const blocked = shouldEventBeBlocked(event, player.equipment, rng);

  if (blocked) {
    return {
      type: event.type,
      blocked: true,
      effects: {}
    };
  }

  // Apply event-specific effects
  const effects: {
    pushDistance?: number;
    itemsLost?: ItemType[];
    bonusItems?: { itemType: ItemType; position: Position }[];
    hardnessBonus?: number;
    hardnessDuration?: number;
    torchBlackoutDuration?: number;
    playerNewY?: number;
  } = {};

  if (event.type === 'cave_in') {
    // Push player upward
    const newY = Math.max(0, player.position.y - CAVE_IN_PUSH_DISTANCE);
    effects.pushDistance = CAVE_IN_PUSH_DISTANCE;
    effects.playerNewY = newY;

    // Lose random items
    const lostItems = removeRandomItems(player.inventory, CAVE_IN_ITEMS_LOST, rng);
    effects.itemsLost = lostItems;
  } else if (event.type === 'gas_pocket') {
    // Torch blackout duration
    effects.torchBlackoutDuration = GAS_POCKET_DURATION;
  } else if (event.type === 'underground_spring') {
    // Reveal 3-5 bonus items from current layer
    const bonusCount = 3 + Math.floor(rng() * 3); // 3, 4, or 5
    const bonusItems: { itemType: ItemType; position: Position }[] = [];
    const layer = getLayerAtDepth(depth);

    for (let i = 0; i < bonusCount; i++) {
      // Force a drop from current layer (ignore drop chance, always drop)
      const totalWeight = layer.lootTable.reduce((sum, entry) => sum + entry.weight, 0);
      let roll = rng() * totalWeight;

      let itemType: ItemType | null = null;
      for (let j = 0; j < layer.lootTable.length; j++) {
        const entry = layer.lootTable[j];
        roll -= entry.weight;
        if (roll <= 0) {
          itemType = entry.itemType;
          break;
        }
      }

      // Fallback if roll failed
      if (itemType === null) {
        itemType = layer.lootTable[0].itemType;
      }

      // Spawn item near player
      const offsetX = Math.floor(rng() * 5) - 2; // -2 to +2
      const offsetY = Math.floor(rng() * 3) - 1; // -1 to +1
      bonusItems.push({
        itemType: itemType,
        position: {
          x: player.position.x + offsetX,
          y: player.position.y + offsetY
        }
      });
    }

    effects.bonusItems = bonusItems;
  } else if (event.type === 'treasure_chest') {
    // Drop 1 rare item from current layer + 50% chance from layer below
    const bonusItems: { itemType: ItemType; position: Position }[] = [];
    const currentLayer = getLayerAtDepth(depth);

    // Guaranteed rare item from current layer
    const currentLayerItem = rollLootDrop(depth, rng);
    if (currentLayerItem !== null) {
      bonusItems.push({
        itemType: currentLayerItem,
        position: {
          x: player.position.x,
          y: player.position.y
        }
      });
    }

    // 50% chance of item from layer below
    if (rng() < 0.5) {
      const layerBelowDepth = currentLayer.depthEnd; // First block of next layer
      const layerBelowItem = rollLootDrop(layerBelowDepth, rng);
      if (layerBelowItem !== null) {
        bonusItems.push({
          itemType: layerBelowItem,
          position: {
            x: player.position.x + 1,
            y: player.position.y
          }
        });
      }
    }

    effects.bonusItems = bonusItems;
  } else if (event.type === 'rock_slide') {
    // Next blocks have increased hardness
    effects.hardnessBonus = ROCK_SLIDE_HARDNESS_BONUS;
    effects.hardnessDuration = ROCK_SLIDE_DURATION_BLOCKS;
  }

  return {
    type: event.type,
    blocked: false,
    effects
  };
}

/**
 * Gets the display name for an event type.
 * Useful for UI notifications.
 *
 * @param eventType - The event type identifier
 * @returns Human-readable event name
 */
export function getEventDisplayName(eventType: string): string {
  const event = EVENTS[eventType.toUpperCase()];
  return event ? event.displayName : 'Unknown Event';
}

/**
 * Gets the description for an event type.
 * Useful for tooltips and help text.
 *
 * @param eventType - The event type identifier
 * @returns Event description text
 */
export function getEventDescription(eventType: string): string {
  const event = EVENTS[eventType.toUpperCase()];
  return event ? event.description : 'Unknown event occurred.';
}

/**
 * Checks if an event is positive (beneficial to player).
 *
 * @param eventType - The event type identifier
 * @returns True if event benefits player
 */
export function isEventPositive(eventType: string): boolean {
  const event = EVENTS[eventType.toUpperCase()];
  return event ? event.isPositive : false;
}

/**
 * Gets all event definitions.
 * Useful for documentation and UI displays.
 *
 * @returns Array of all event definitions
 */
export function getAllEvents(): RandomEvent[] {
  const eventTypes = Object.keys(EVENTS);
  const events: RandomEvent[] = [];
  for (let i = 0; i < eventTypes.length; i++) {
    events.push(EVENTS[eventTypes[i]]);
  }
  return events;
}

/**
 * Calculates the total probability of any event occurring per block.
 * Useful for balancing and statistics.
 *
 * @returns Sum of all event trigger chances
 */
export function getTotalEventChance(): number {
  let total = 0;
  const eventTypes = Object.keys(EVENTS);
  for (let i = 0; i < eventTypes.length; i++) {
    total += EVENTS[eventTypes[i]].triggerChance;
  }
  return total;
}
