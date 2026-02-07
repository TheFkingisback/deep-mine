import { LayerName, LayerDefinition, ItemType, BlockType } from './types';

/**
 * Complete registry of all vertical layer zones in Deep Mine.
 * Each layer defines depth range, difficulty, appearance, loot tables, and hazards.
 */
export const LAYERS: Record<LayerName, LayerDefinition> = {
  [LayerName.DIRT]: {
    name: LayerName.DIRT,
    displayName: "Surface Dirt",
    depthStart: 0,
    depthEnd: 50,
    baseHardness: 1,
    color: "#8B6914",
    tntSpawnChance: 0.02,
    tntGoldPenalty: 10,
    dropChance: 0.30,
    lootTable: [
      { itemType: 'dirt', weight: 60 },
      { itemType: 'clay', weight: 25 },
      { itemType: 'copper_ore', weight: 10 },
      { itemType: 'lost_coins', weight: 5 }
    ],
    ambientColor: "#D4A574",
    blockTypes: [BlockType.DIRT, BlockType.TNT]
  },
  [LayerName.DEEP_CLAY]: {
    name: LayerName.DEEP_CLAY,
    displayName: "Deep Clay",
    depthStart: 51,
    depthEnd: 150,
    baseHardness: 2,
    color: "#5C4033",
    tntSpawnChance: 0.03,
    tntGoldPenalty: 30,
    dropChance: 0.28,
    lootTable: [
      { itemType: 'iron_ore', weight: 40 },
      { itemType: 'silver_nugget', weight: 25 },
      { itemType: 'lost_compass', weight: 15 },
      { itemType: 'fossil', weight: 15 },
      { itemType: 'ammonite', weight: 5 }
    ],
    ambientColor: "#8B6F47",
    blockTypes: [BlockType.CLAY_BLOCK, BlockType.TNT]
  },
  [LayerName.ROCK]: {
    name: LayerName.ROCK,
    displayName: "Rock Layer",
    depthStart: 151,
    depthEnd: 300,
    baseHardness: 4,
    color: "#808080",
    tntSpawnChance: 0.04,
    tntGoldPenalty: 75,
    dropChance: 0.25,
    lootTable: [
      { itemType: 'gold_ore', weight: 35 },
      { itemType: 'emerald_shard', weight: 25 },
      { itemType: 'lost_pocket_watch', weight: 15 },
      { itemType: 'ammonite', weight: 25 }
    ],
    ambientColor: "#A9A9A9",
    blockTypes: [BlockType.ROCK, BlockType.TNT]
  },
  [LayerName.DENSE_ROCK]: {
    name: LayerName.DENSE_ROCK,
    displayName: "Dense Rock",
    depthStart: 301,
    depthEnd: 500,
    baseHardness: 7,
    color: "#505050",
    tntSpawnChance: 0.05,
    tntGoldPenalty: 200,
    dropChance: 0.22,
    lootTable: [
      { itemType: 'ruby_ore', weight: 30 },
      { itemType: 'sapphire_ore', weight: 25 },
      { itemType: 'lost_crown', weight: 20 },
      { itemType: 'ancient_coin', weight: 25 }
    ],
    ambientColor: "#707070",
    blockTypes: [BlockType.DENSE_ROCK, BlockType.TNT]
  },
  [LayerName.OBSIDIAN]: {
    name: LayerName.OBSIDIAN,
    displayName: "Obsidian Depths",
    depthStart: 501,
    depthEnd: 800,
    baseHardness: 12,
    color: "#1A0A2E",
    tntSpawnChance: 0.06,
    tntGoldPenalty: 500,
    dropChance: 0.20,
    lootTable: [
      { itemType: 'diamond_ore', weight: 40 },
      { itemType: 'amethyst_cluster', weight: 35 },
      { itemType: 'lost_scepter', weight: 25 }
    ],
    ambientColor: "#2E1A47",
    blockTypes: [BlockType.OBSIDIAN, BlockType.TNT]
  },
  [LayerName.COLD_MAGMA]: {
    name: LayerName.COLD_MAGMA,
    displayName: "Cold Magma",
    depthStart: 801,
    depthEnd: 1200,
    baseHardness: 18,
    color: "#4A0000",
    tntSpawnChance: 0.07,
    tntGoldPenalty: 1500,
    dropChance: 0.18,
    lootTable: [
      { itemType: 'dragonstone', weight: 35 },
      { itemType: 'mythril_ore', weight: 40 },
      { itemType: 'lost_amulet', weight: 25 }
    ],
    ambientColor: "#6B0000",
    blockTypes: [BlockType.COLD_MAGMA, BlockType.TNT]
  },
  [LayerName.VOID_STONE]: {
    name: LayerName.VOID_STONE,
    displayName: "Void Stone",
    depthStart: 1201,
    depthEnd: Infinity,
    baseHardness: 25,
    color: "#0A0014",
    tntSpawnChance: 0.08,
    tntGoldPenalty: 5000,
    dropChance: 0.15,
    lootTable: [
      { itemType: 'void_crystal', weight: 35 },
      { itemType: 'celestial_ore', weight: 35 },
      { itemType: 'lost_artifact', weight: 30 }
    ],
    ambientColor: "#1A0A2E",
    blockTypes: [BlockType.VOID_STONE, BlockType.TNT]
  }
};

/**
 * Array of layer names ordered by depth for iteration.
 * Useful for finding the current layer based on depth.
 */
const LAYER_ORDER: LayerName[] = [
  LayerName.DIRT,
  LayerName.DEEP_CLAY,
  LayerName.ROCK,
  LayerName.DENSE_ROCK,
  LayerName.OBSIDIAN,
  LayerName.COLD_MAGMA,
  LayerName.VOID_STONE
];

/**
 * Retrieves the layer definition for a given depth.
 * @param depth - The Y coordinate (0 = surface, increases downward)
 * @returns The LayerDefinition for the layer at this depth
 */
export function getLayerAtDepth(depth: number): LayerDefinition {
  for (const layerName of LAYER_ORDER) {
    const layer = LAYERS[layerName];
    if (depth >= layer.depthStart && depth < layer.depthEnd) {
      return layer;
    }
  }
  // If depth exceeds all ranges, return VOID_STONE (infinite layer)
  return LAYERS[LayerName.VOID_STONE];
}

/**
 * Calculates the block hardness at a specific depth.
 * VOID_STONE hardness increases by 0.01 per block beyond depth 1201.
 * @param depth - The Y coordinate
 * @returns The hardness multiplier for blocks at this depth
 */
export function getBlockHardness(depth: number): number {
  const layer = getLayerAtDepth(depth);

  // VOID_STONE scales with depth
  if (layer.name === LayerName.VOID_STONE && depth > 1201) {
    const blocksIntoVoid = depth - 1201;
    return layer.baseHardness + (blocksIntoVoid * 0.01);
  }

  return layer.baseHardness;
}

/**
 * Returns the TNT spawn chance for a given depth.
 * @param depth - The Y coordinate
 * @returns Probability (0-1) of a block being TNT
 */
export function getTntChance(depth: number): number {
  const layer = getLayerAtDepth(depth);
  return layer.tntSpawnChance;
}

/**
 * Returns the gold penalty when TNT explodes at a given depth.
 * @param depth - The Y coordinate
 * @returns Amount of gold deducted from player on TNT explosion
 */
export function getTntGoldPenalty(depth: number): number {
  const layer = getLayerAtDepth(depth);
  return layer.tntGoldPenalty;
}

/**
 * Performs a weighted random loot drop roll for a block at given depth.
 * First checks if any loot drops (based on layer dropChance),
 * then selects an item from the layer's loot table using weighted random selection.
 *
 * @param depth - The Y coordinate of the broken block
 * @param rng - Random number generator function returning values [0, 1)
 * @returns The ItemType that dropped, or null if no drop
 */
export function rollLootDrop(depth: number, rng: () => number): ItemType | null {
  const layer = getLayerAtDepth(depth);

  // First roll: does anything drop?
  if (rng() > layer.dropChance) {
    return null;
  }

  // Second roll: which item from the loot table?
  const totalWeight = layer.lootTable.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;

  for (const entry of layer.lootTable) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.itemType;
    }
  }

  // Fallback (should never reach here if weights are valid)
  return layer.lootTable[0].itemType;
}

/**
 * Gets the display name for a layer at a given depth.
 * Useful for UI elements showing current layer.
 * @param depth - The Y coordinate
 * @returns Human-readable layer name
 */
export function getLayerDisplayName(depth: number): string {
  return getLayerAtDepth(depth).displayName;
}

/**
 * Gets the ambient color for a layer at a given depth.
 * Used for background tinting and atmospheric effects.
 * @param depth - The Y coordinate
 * @returns Hex color string for ambient lighting
 */
export function getLayerAmbientColor(depth: number): string {
  return getLayerAtDepth(depth).ambientColor;
}

/**
 * Gets the base block color for a layer at a given depth.
 * Used for rendering blocks in this layer.
 * @param depth - The Y coordinate
 * @returns Hex color string for block rendering
 */
export function getLayerBlockColor(depth: number): string {
  return getLayerAtDepth(depth).color;
}

/**
 * Checks if a given depth allows a specific block type.
 * @param depth - The Y coordinate
 * @param blockType - The block type to check
 * @returns True if this block type can exist at this depth
 */
export function isBlockTypeAllowedAtDepth(depth: number, blockType: BlockType): boolean {
  const layer = getLayerAtDepth(depth);
  return layer.blockTypes.indexOf(blockType) !== -1;
}
