/**
 * Defines all block types that can exist in the game world.
 * Blocks are the fundamental building units of the terrain.
 */
export enum BlockType {
  /** Empty space (air) - no collision */
  EMPTY = 'empty',
  /** Basic dirt block found in shallow layers */
  DIRT = 'dirt',
  /** Clay block found in deep clay layers */
  CLAY_BLOCK = 'clay_block',
  /** Standard rock - medium hardness */
  ROCK = 'rock',
  /** Dense rock - high hardness */
  DENSE_ROCK = 'dense_rock',
  /** Obsidian - very high hardness */
  OBSIDIAN = 'obsidian',
  /** Cold magma - extreme hardness */
  COLD_MAGMA = 'cold_magma',
  /** Void stone - maximum hardness */
  VOID_STONE = 'void_stone',
  /** TNT block - explodes when mined, causing chain reactions */
  TNT = 'tnt',
  /** Unknown/fallback block type */
  UNKNOWN = 'unknown'
}

/**
 * Defines vertical layer zones in the game world.
 * Each layer has unique properties, loot tables, and difficulty.
 */
export enum LayerName {
  /** Surface dirt layer */
  DIRT = 'DIRT',
  /** Deep clay layer with clay blocks */
  DEEP_CLAY = 'DEEP_CLAY',
  /** Rock layer with standard rock */
  ROCK = 'ROCK',
  /** Dense rock layer with harder blocks */
  DENSE_ROCK = 'DENSE_ROCK',
  /** Obsidian layer with very hard blocks */
  OBSIDIAN = 'OBSIDIAN',
  /** Cold magma layer - extreme depths */
  COLD_MAGMA = 'COLD_MAGMA',
  /** Void stone layer - deepest possible */
  VOID_STONE = 'VOID_STONE'
}

/**
 * All possible item types that can be collected and stored in inventory.
 * Items are dropped from blocks and can be sold for gold.
 */
export type ItemType =
  | 'dirt' | 'clay' | 'copper_ore' | 'lost_coins'
  | 'iron_ore' | 'silver_nugget' | 'lost_compass' | 'fossil' | 'ammonite'
  | 'gold_ore' | 'emerald_shard' | 'lost_pocket_watch'
  | 'ruby_ore' | 'sapphire_ore' | 'lost_crown' | 'ancient_coin'
  | 'diamond_ore' | 'amethyst_cluster' | 'lost_scepter'
  | 'dragonstone' | 'mythril_ore' | 'lost_amulet'
  | 'void_crystal' | 'celestial_ore' | 'lost_artifact';

/**
 * Equipment slot types for player gear.
 * Each slot can hold equipment of varying tiers.
 */
export enum EquipmentSlot {
  /** Mining tool - affects dig speed and damage */
  SHOVEL = 'shovel',
  /** Head protection - affects safety */
  HELMET = 'helmet',
  /** Body protection - affects durability */
  VEST = 'vest',
  /** Light source - affects visibility range */
  TORCH = 'torch',
  /** Climbing tool - affects mobility */
  ROPE = 'rope'
}

/**
 * Equipment tier levels from 1 (basic) to 7 (legendary).
 * Higher tiers provide better stats and cost more gold.
 */
export type EquipmentTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * 2D position in the game world.
 * Origin (0, 0) is at the surface center.
 */
export interface Position {
  /** Horizontal coordinate (left-right) */
  x: number;
  /** Vertical coordinate (up-down, increases downward) */
  y: number;
}

/**
 * Represents a single block in the game world.
 * Blocks have durability and must be broken to mine through.
 */
export interface Block {
  /** The type of block determining its properties */
  type: BlockType;
  /** Current hit points remaining before block breaks */
  hp: number;
  /** Maximum hit points this block started with */
  maxHp: number;
  /** Horizontal position in world coordinates */
  x: number;
  /** Vertical position in world coordinates */
  y: number;
}

/**
 * A single slot in the player's inventory.
 * Slots can stack items up to MAX_STACK_SIZE.
 */
export interface InventorySlot {
  /** Type of item stored in this slot */
  itemType: ItemType;
  /** Number of items in this stack */
  quantity: number;
}

/**
 * Complete state of a player character.
 * This is the authoritative state managed by the server.
 */
export interface PlayerState {
  /** Unique identifier for this player */
  id: string;
  /** Current position in the game world */
  position: Position;
  /** Amount of gold currency owned */
  gold: number;
  /** Equipped items by slot with their tier levels */
  equipment: Record<EquipmentSlot, EquipmentTier>;
  /** Inventory slots (null = empty slot) */
  inventory: (InventorySlot | null)[];
  /** Total number of inventory slots available */
  maxInventorySlots: number;
  /** Current inventory expansion level (0 = base) */
  inventoryUpgradeLevel: number;
  /** Deepest Y coordinate ever reached */
  maxDepthReached: number;
  /** List of checkpoint positions player can teleport to */
  checkpoints: Position[];
  /** Whether player is currently stunned (from TNT) */
  isStunned: boolean;
  /** Timestamp when stun effect ends (null if not stunned) */
  stunEndTime: number | null;
  /** Whether player is currently at surface level */
  isOnSurface: boolean;
}

/**
 * A chunk of world data representing a vertical slice of terrain.
 * Chunks are generated on-demand and cached.
 */
export interface ChunkData {
  /** Vertical chunk coordinate (chunk Y position) */
  chunkY: number;
  /** 2D array of blocks [x][y] within this chunk */
  blocks: Block[][];
  /** Random seed used to generate this chunk */
  seed: number;
}

/**
 * A collectable item dropped in the world.
 * Items despawn after a timeout if not collected.
 */
export interface DropItem {
  /** Unique identifier for this drop */
  id: string;
  /** Type of item that was dropped */
  itemType: ItemType;
  /** World position where item is located */
  position: Position;
  /** Player ID who collected this item (null if uncollected) */
  collectedBy: string | null;
  /** Server timestamp when this item was spawned */
  spawnedAt: number;
}

/**
 * Static definition of an item type's properties.
 * Used for displaying item info and calculating value.
 */
export interface ItemDefinition {
  /** Display name of the item */
  name: string;
  /** Flavor text describing the item */
  description: string;
  /** Base gold value when sold */
  value: number;
  /** Rarity tier affecting drop rates */
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  /** Which layer this item is found in */
  layer: LayerName;
  /** Emoji icon for visual representation */
  emoji: string;
}

/**
 * Static definition of an equipment piece.
 * Equipment can be purchased and equipped to improve player stats.
 */
export interface EquipmentDefinition {
  /** Display name of the equipment */
  name: string;
  /** Tier level (1-7) */
  tier: EquipmentTier;
  /** Gold cost to purchase */
  price: number;
  /** Description of equipment benefits */
  description: string;
  /** Slot-specific stats (e.g., digPower, lightRadius) */
  stats: Record<string, number>;
}

/**
 * Defines properties of a vertical layer zone.
 * Layers determine difficulty, appearance, and loot.
 */
export interface LayerDefinition {
  /** Internal layer identifier */
  name: LayerName;
  /** Human-readable layer name */
  displayName: string;
  /** Starting Y coordinate (inclusive) */
  depthStart: number;
  /** Ending Y coordinate (exclusive, Infinity for last layer) */
  depthEnd: number;
  /** Base hardness multiplier for blocks in this layer */
  baseHardness: number;
  /** Primary color for blocks in this layer */
  color: string;
  /** Probability of TNT spawning per block (0-1) */
  tntSpawnChance: number;
  /** Gold deducted when TNT explodes in this layer */
  tntGoldPenalty: number;
  /** Base chance of item drop per block broken (0-1) */
  dropChance: number;
  /** Weighted list of items that can drop in this layer */
  lootTable: { itemType: ItemType; weight: number }[];
  /** Background tint color for ambient atmosphere */
  ambientColor: string;
  /** Which block types naturally generate in this layer */
  blockTypes: BlockType[];
}

/**
 * Defines a random event that can occur during mining.
 * Events add dynamic challenges and opportunities.
 */
export interface RandomEvent {
  /** Internal event type identifier */
  type: 'cave_in' | 'gas_pocket' | 'underground_spring' | 'treasure_chest' | 'rock_slide';
  /** Human-readable event name */
  displayName: string;
  /** Description of what happens during this event */
  description: string;
  /** Whether this event benefits (true) or hinders (false) the player */
  isPositive: boolean;
  /** Probability of triggering per block dug (0-1) */
  triggerChance: number;
}
