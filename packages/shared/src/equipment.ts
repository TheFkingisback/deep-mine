import { EquipmentSlot, EquipmentTier, EquipmentDefinition } from './types';

/**
 * Complete registry of all equipment items in Deep Mine.
 * Organized by slot, then by tier (1-7).
 * Players start with all tier 1 equipment and must upgrade sequentially.
 */
export const EQUIPMENT: Record<EquipmentSlot, Record<EquipmentTier, EquipmentDefinition>> = {
  [EquipmentSlot.SHOVEL]: {
    1: {
      name: "Wooden Shovel",
      tier: 1,
      price: 0,
      description: "A basic wooden shovel. Gets the job done... slowly.",
      stats: { damage: 1 }
    },
    2: {
      name: "Copper Shovel",
      tier: 2,
      price: 50,
      description: "Copper-tipped for better dig speed.",
      stats: { damage: 2 }
    },
    3: {
      name: "Iron Shovel",
      tier: 3,
      price: 200,
      description: "Solid iron. Cuts through clay like butter.",
      stats: { damage: 4 }
    },
    4: {
      name: "Gold Shovel",
      tier: 4,
      price: 800,
      description: "Heavy gold head. Smashes dense rock.",
      stats: { damage: 7 }
    },
    5: {
      name: "Crystal Shovel",
      tier: 5,
      price: 3000,
      description: "Crystal edge vibrates through obsidian.",
      stats: { damage: 12 }
    },
    6: {
      name: "Mythril Shovel",
      tier: 6,
      price: 10000,
      description: "Almost weightless but impossibly strong.",
      stats: { damage: 18 }
    },
    7: {
      name: "Void Shovel",
      tier: 7,
      price: 50000,
      description: "Cuts through reality itself.",
      stats: { damage: 30 }
    }
  },
  [EquipmentSlot.HELMET]: {
    1: {
      name: "Cloth Cap",
      tier: 1,
      price: 0,
      description: "Basic head covering. Blocks sun, not much else.",
      stats: { maxDepth: 50 }
    },
    2: {
      name: "Leather Helmet",
      tier: 2,
      price: 80,
      description: "Tanned leather provides modest protection deeper down.",
      stats: { maxDepth: 150 }
    },
    3: {
      name: "Iron Helmet",
      tier: 3,
      price: 350,
      description: "Forged iron withstands pressure at moderate depths.",
      stats: { maxDepth: 300 }
    },
    4: {
      name: "Steel Helmet",
      tier: 4,
      price: 1200,
      description: "Reinforced steel allows you to venture deeper.",
      stats: { maxDepth: 500 }
    },
    5: {
      name: "Crystal Helmet",
      tier: 5,
      price: 5000,
      description: "Crystal lattice disperses extreme pressure.",
      stats: { maxDepth: 800 }
    },
    6: {
      name: "Mythril Helmet",
      tier: 6,
      price: 18000,
      description: "Mythril never yields, no matter the depth.",
      stats: { maxDepth: 1200 }
    },
    7: {
      name: "Void Helmet",
      tier: 7,
      price: 75000,
      description: "Transcends physical limits. Dive forever.",
      stats: { maxDepth: Infinity }
    }
  },
  [EquipmentSlot.VEST]: {
    1: {
      name: "Cloth Vest",
      tier: 1,
      price: 0,
      description: "Simple cloth. Better than nothing.",
      stats: { bonusSlots: 0, protection: 0 }
    },
    2: {
      name: "Leather Vest",
      tier: 2,
      price: 60,
      description: "Leather with pockets. Slight protection from hazards.",
      stats: { bonusSlots: 2, protection: 0.10 }
    },
    3: {
      name: "Chain Vest",
      tier: 3,
      price: 300,
      description: "Chainmail with storage pouches. Deflects some danger.",
      stats: { bonusSlots: 4, protection: 0.25 }
    },
    4: {
      name: "Steel Vest",
      tier: 4,
      price: 1000,
      description: "Steel plates and reinforced pouches. Good protection.",
      stats: { bonusSlots: 6, protection: 0.40 }
    },
    5: {
      name: "Crystal Vest",
      tier: 5,
      price: 4500,
      description: "Crystal weave holds more and shields better.",
      stats: { bonusSlots: 8, protection: 0.60 }
    },
    6: {
      name: "Mythril Vest",
      tier: 6,
      price: 16000,
      description: "Mythril mesh is nearly impenetrable.",
      stats: { bonusSlots: 10, protection: 0.80 }
    },
    7: {
      name: "Void Vest",
      tier: 7,
      price: 65000,
      description: "Void-forged armor. Almost nothing can harm you.",
      stats: { bonusSlots: 12, protection: 0.95 }
    }
  },
  [EquipmentSlot.TORCH]: {
    1: {
      name: "Candle",
      tier: 1,
      price: 0,
      description: "A flickering candle. Barely lights your way.",
      stats: { radius: 2 }
    },
    2: {
      name: "Wooden Torch",
      tier: 2,
      price: 40,
      description: "Classic torch. Burns steady and bright enough.",
      stats: { radius: 3 }
    },
    3: {
      name: "Oil Lantern",
      tier: 3,
      price: 180,
      description: "Enclosed flame provides reliable illumination.",
      stats: { radius: 4 }
    },
    4: {
      name: "Bright Lantern",
      tier: 4,
      price: 700,
      description: "Polished reflectors amplify the light.",
      stats: { radius: 5 }
    },
    5: {
      name: "Crystal Lamp",
      tier: 5,
      price: 3500,
      description: "Glowing crystal needs no fuel. Pierces darkness.",
      stats: { radius: 7 }
    },
    6: {
      name: "Mythril Beacon",
      tier: 6,
      price: 12000,
      description: "Mythril-caged radiance illuminates vast caverns.",
      stats: { radius: 9 }
    },
    7: {
      name: "Void Star",
      tier: 7,
      price: 55000,
      description: "A captured star. Darkness flees before it.",
      stats: { radius: 12 }
    }
  },
  [EquipmentSlot.ROPE]: {
    1: {
      name: "Thin Rope",
      tier: 1,
      price: 0,
      description: "Frayed rope. Climbs slowly, no checkpoints.",
      stats: { speed: 5, maxCheckpoints: 0 }
    },
    2: {
      name: "Hemp Rope",
      tier: 2,
      price: 50,
      description: "Stronger hemp. Climbs faster but still no checkpoints.",
      stats: { speed: 15, maxCheckpoints: 0 }
    },
    3: {
      name: "Strong Rope",
      tier: 3,
      price: 250,
      description: "Woven cord. Faster climbs and one checkpoint available.",
      stats: { speed: 40, maxCheckpoints: 1 }
    },
    4: {
      name: "Steel Cable",
      tier: 4,
      price: 900,
      description: "Steel cable. Very fast ascent with two checkpoints.",
      stats: { speed: 100, maxCheckpoints: 2 }
    },
    5: {
      name: "Crystal Fiber",
      tier: 5,
      price: 4000,
      description: "Crystal threads. Instant ascent with three checkpoints.",
      stats: { speed: -1, maxCheckpoints: 3 }
    },
    6: {
      name: "Mythril Wire",
      tier: 6,
      price: 14000,
      description: "Mythril wire. Instant travel, four checkpoints.",
      stats: { speed: -1, maxCheckpoints: 4 }
    },
    7: {
      name: "Void Tether",
      tier: 7,
      price: 60000,
      description: "Void-bound connection. Instant anywhere, five checkpoints.",
      stats: { speed: -1, maxCheckpoints: 5 }
    }
  }
};

/**
 * Returns the damage dealt per dig action for a given shovel tier.
 * @param tier - The shovel tier (1-7)
 * @returns Damage value subtracted from block HP per tap
 */
export function getShovelDamage(tier: EquipmentTier): number {
  return EQUIPMENT[EquipmentSlot.SHOVEL][tier].stats.damage;
}

/**
 * Returns the maximum depth a player can reach with a given helmet tier.
 * @param tier - The helmet tier (1-7)
 * @returns Maximum Y coordinate allowed (Infinity for tier 7)
 */
export function getMaxDepth(tier: EquipmentTier): number {
  return EQUIPMENT[EquipmentSlot.HELMET][tier].stats.maxDepth;
}

/**
 * Returns the bonus inventory slots granted by a vest tier.
 * @param tier - The vest tier (1-7)
 * @returns Number of additional inventory slots
 */
export function getVestBonusSlots(tier: EquipmentTier): number {
  return EQUIPMENT[EquipmentSlot.VEST][tier].stats.bonusSlots;
}

/**
 * Returns the event protection percentage for a given vest tier.
 * @param tier - The vest tier (1-7)
 * @returns Protection value (0.0 to 0.95) representing chance to avoid negative events
 */
export function getVestProtection(tier: EquipmentTier): number {
  return EQUIPMENT[EquipmentSlot.VEST][tier].stats.protection;
}

/**
 * Returns the visibility radius in blocks for a given torch tier.
 * @param tier - The torch tier (1-7)
 * @returns Radius in blocks that the torch illuminates
 */
export function getTorchRadius(tier: EquipmentTier): number {
  return EQUIPMENT[EquipmentSlot.TORCH][tier].stats.radius;
}

/**
 * Returns the ascent speed in blocks per second for a given rope tier.
 * @param tier - The rope tier (1-7)
 * @returns Speed in blocks/sec, or -1 for instant teleport (tiers 5-7)
 */
export function getRopeSpeed(tier: EquipmentTier): number {
  return EQUIPMENT[EquipmentSlot.ROPE][tier].stats.speed;
}

/**
 * Returns the maximum number of checkpoints allowed for a given rope tier.
 * @param tier - The rope tier (1-7)
 * @returns Number of checkpoints that can be placed (0-5)
 */
export function getMaxCheckpoints(tier: EquipmentTier): number {
  return EQUIPMENT[EquipmentSlot.ROPE][tier].stats.maxCheckpoints;
}

/**
 * Returns the gold price of a specific equipment piece.
 * @param slot - The equipment slot
 * @param tier - The equipment tier (1-7)
 * @returns Gold cost to purchase this equipment
 */
export function getEquipmentPrice(slot: EquipmentSlot, tier: EquipmentTier): number {
  return EQUIPMENT[slot][tier].price;
}

/**
 * Returns the display name of a specific equipment piece.
 * @param slot - The equipment slot
 * @param tier - The equipment tier (1-7)
 * @returns Human-readable name of the equipment
 */
export function getEquipmentName(slot: EquipmentSlot, tier: EquipmentTier): string {
  return EQUIPMENT[slot][tier].name;
}

/**
 * Checks whether a player can purchase an equipment upgrade.
 * Players must upgrade sequentially (cannot skip tiers).
 * @param slot - The equipment slot to upgrade
 * @param currentTier - The player's current tier for this slot
 * @param gold - The player's current gold amount
 * @returns Object with canBuy boolean and optional reason for failure
 */
export function canBuyEquipment(
  slot: EquipmentSlot,
  currentTier: EquipmentTier,
  gold: number
): { canBuy: boolean; reason?: string } {
  // Check if already at max tier
  if (currentTier === 7) {
    return { canBuy: false, reason: "Already at maximum tier" };
  }

  const nextTier = (currentTier + 1) as EquipmentTier;
  const price = EQUIPMENT[slot][nextTier].price;

  // Check if player has enough gold
  if (gold < price) {
    return { canBuy: false, reason: `Need ${price} gold (have ${gold})` };
  }

  return { canBuy: true };
}

/**
 * Returns the next tier level, or null if already at maximum.
 * @param currentTier - The current equipment tier
 * @returns Next tier (2-7) or null if at tier 7
 */
export function getNextTier(currentTier: EquipmentTier): EquipmentTier | null {
  if (currentTier === 7) {
    return null;
  }
  return (currentTier + 1) as EquipmentTier;
}

/**
 * Calculates the total gold value of all equipped items.
 * Useful for stats display, leaderboards, and progression tracking.
 * @param equipment - Record of current equipment tiers by slot
 * @returns Sum of all equipped items' purchase prices
 */
export function getTotalEquipmentValue(equipment: Record<EquipmentSlot, EquipmentTier>): number {
  return (Object.keys(equipment) as EquipmentSlot[]).reduce((total, slot) => {
    const tier = equipment[slot];
    return total + EQUIPMENT[slot][tier].price;
  }, 0);
}
