import { ItemType, ItemDefinition, LayerName } from './types';

/**
 * Complete registry of all collectible items in Deep Mine.
 * Maps each ItemType to its full definition including name, value, rarity, and layer.
 */
export const ITEMS: Record<ItemType, ItemDefinition> = {
  dirt: {
    name: "Dirt",
    value: 1,
    rarity: "common",
    layer: LayerName.DIRT,
    emoji: "🟤",
    description: "Basic soil. Not worth much, but it adds up."
  },
  clay: {
    name: "Clay",
    value: 3,
    rarity: "common",
    layer: LayerName.DIRT,
    emoji: "🧱",
    description: "Moldable clay. Potters pay a few coins for it."
  },
  copper_ore: {
    name: "Copper Ore",
    value: 8,
    rarity: "common",
    layer: LayerName.DIRT,
    emoji: "🔶",
    description: "A greenish metallic ore. Decent starter find."
  },
  lost_coins: {
    name: "Lost Coins",
    value: 15,
    rarity: "uncommon",
    layer: LayerName.DIRT,
    emoji: "🪙",
    description: "Someone dropped these long ago."
  },
  iron_ore: {
    name: "Iron Ore",
    value: 20,
    rarity: "common",
    layer: LayerName.DEEP_CLAY,
    emoji: "⬛",
    description: "Heavy, dark ore. The backbone of industry."
  },
  silver_nugget: {
    name: "Silver Nugget",
    value: 35,
    rarity: "uncommon",
    layer: LayerName.DEEP_CLAY,
    emoji: "⬜",
    description: "A gleaming silver chunk."
  },
  lost_compass: {
    name: "Lost Compass",
    value: 40,
    rarity: "uncommon",
    layer: LayerName.DEEP_CLAY,
    emoji: "🧭",
    description: "Still points north. Someone missed this."
  },
  fossil: {
    name: "Fossil",
    value: 50,
    rarity: "uncommon",
    layer: LayerName.DEEP_CLAY,
    emoji: "🦴",
    description: "An ancient creature preserved in stone."
  },
  ammonite: {
    name: "Ammonite",
    value: 90,
    rarity: "uncommon",
    layer: LayerName.ROCK,
    emoji: "🐚",
    description: "A beautiful spiral shell fossil."
  },
  gold_ore: {
    name: "Gold Ore",
    value: 80,
    rarity: "uncommon",
    layer: LayerName.ROCK,
    emoji: "🥇",
    description: "The classic treasure. Heavy and warm."
  },
  emerald_shard: {
    name: "Emerald Shard",
    value: 120,
    rarity: "rare",
    layer: LayerName.ROCK,
    emoji: "💚",
    description: "A fragment of deep green crystal."
  },
  lost_pocket_watch: {
    name: "Lost Pocket Watch",
    value: 200,
    rarity: "rare",
    layer: LayerName.ROCK,
    emoji: "⌚",
    description: "An ornate timepiece. Still ticking."
  },
  ruby_ore: {
    name: "Ruby Ore",
    value: 300,
    rarity: "rare",
    layer: LayerName.DENSE_ROCK,
    emoji: "❤️",
    description: "Deep crimson ore veined with fire."
  },
  sapphire_ore: {
    name: "Sapphire Ore",
    value: 350,
    rarity: "rare",
    layer: LayerName.DENSE_ROCK,
    emoji: "💙",
    description: "Cool blue crystal embedded in dark stone."
  },
  lost_crown: {
    name: "Lost Crown",
    value: 450,
    rarity: "rare",
    layer: LayerName.DENSE_ROCK,
    emoji: "👑",
    description: "A royal crown, buried for centuries."
  },
  ancient_coin: {
    name: "Ancient Coin",
    value: 500,
    rarity: "rare",
    layer: LayerName.DENSE_ROCK,
    emoji: "🏛️",
    description: "Currency from a forgotten civilization."
  },
  diamond_ore: {
    name: "Diamond Ore",
    value: 800,
    rarity: "epic",
    layer: LayerName.OBSIDIAN,
    emoji: "💎",
    description: "The hardest and most brilliant ore."
  },
  amethyst_cluster: {
    name: "Amethyst Cluster",
    value: 650,
    rarity: "epic",
    layer: LayerName.OBSIDIAN,
    emoji: "🔮",
    description: "A cluster of purple crystals humming with energy."
  },
  lost_scepter: {
    name: "Lost Scepter",
    value: 1500,
    rarity: "epic",
    layer: LayerName.OBSIDIAN,
    emoji: "🏆",
    description: "A ceremonial staff of immense value."
  },
  dragonstone: {
    name: "Dragonstone",
    value: 3000,
    rarity: "epic",
    layer: LayerName.COLD_MAGMA,
    emoji: "🐉",
    description: "A stone said to contain dragon fire."
  },
  mythril_ore: {
    name: "Mythril Ore",
    value: 5000,
    rarity: "epic",
    layer: LayerName.COLD_MAGMA,
    emoji: "✨",
    description: "Lighter than feathers, stronger than steel."
  },
  lost_amulet: {
    name: "Lost Amulet",
    value: 4000,
    rarity: "epic",
    layer: LayerName.COLD_MAGMA,
    emoji: "📿",
    description: "A protective charm from the deep."
  },
  void_crystal: {
    name: "Void Crystal",
    value: 10000,
    rarity: "legendary",
    layer: LayerName.VOID_STONE,
    emoji: "🌑",
    description: "A crystal that absorbs all light."
  },
  celestial_ore: {
    name: "Celestial Ore",
    value: 20000,
    rarity: "legendary",
    layer: LayerName.VOID_STONE,
    emoji: "⭐",
    description: "Ore from beyond the known world."
  },
  lost_artifact: {
    name: "Lost Artifact of the Ancients",
    value: 50000,
    rarity: "legendary",
    layer: LayerName.VOID_STONE,
    emoji: "🗿",
    description: "The ultimate treasure. Civilizations warred over this."
  }
};

/**
 * Retrieves the gold value of a specific item type.
 * @param itemType - The type of item to query
 * @returns The gold value when selling this item
 */
export function getItemValue(itemType: ItemType): number {
  return ITEMS[itemType].value;
}

/**
 * Retrieves the display name of a specific item type.
 * @param itemType - The type of item to query
 * @returns The human-readable name of the item
 */
export function getItemName(itemType: ItemType): string {
  return ITEMS[itemType].name;
}

/**
 * Returns all items that can be found in a specific layer.
 * @param layer - The layer to filter items by
 * @returns Array of item types that spawn in the specified layer
 */
export function getItemsByLayer(layer: LayerName): ItemType[] {
  return (Object.keys(ITEMS) as ItemType[]).filter(
    (itemType) => ITEMS[itemType].layer === layer
  );
}

/**
 * Returns all items of a specific rarity tier.
 * @param rarity - The rarity tier to filter by ('common', 'uncommon', 'rare', 'epic', 'legendary')
 * @returns Array of item types matching the specified rarity
 */
export function getItemsByRarity(rarity: string): ItemType[] {
  return (Object.keys(ITEMS) as ItemType[]).filter(
    (itemType) => ITEMS[itemType].rarity === rarity
  );
}

/**
 * Retrieves the complete definition for a specific item type.
 * @param itemType - The type of item to query
 * @returns The full ItemDefinition including all properties
 */
export function getItemDefinition(itemType: ItemType): ItemDefinition {
  return ITEMS[itemType];
}
