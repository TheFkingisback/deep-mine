/** Width of each world chunk in blocks */
export const CHUNK_WIDTH = 2000;

/** Height of each world chunk in blocks */
export const CHUNK_HEIGHT = 32;

/** Server tick rate (ticks per second) */
export const TICK_RATE = 10;

/** Milliseconds per server tick */
export const TICK_INTERVAL = 100;

/** Maximum players allowed in one shard */
export const MAX_PLAYERS_PER_SHARD = 8;

/** Maximum items per inventory slot stack */
export const MAX_STACK_SIZE = 50;

/** Starting inventory slots for new players */
export const BASE_INVENTORY_SLOTS = 8;

/** Inventory slot counts at each upgrade level [0]=base, [1]=first upgrade... */
export const INVENTORY_UPGRADE_SLOTS = [8, 12, 16, 20, 25, 30] as const;

/** Gold cost for each inventory upgrade level (index 0 = free/base) */
export const INVENTORY_UPGRADE_PRICES = [0, 100, 400, 1200, 4000, 15000] as const;

/** Duration of player stun after TNT explosion (ms) */
export const STUN_DURATION = 1500;

/** TNT explosion destroys blocks within this radius (1 = 3x3 area) */
export const TNT_DESTROY_RADIUS = 1;

/** Blocks the player is launched upward after TNT explosion */
export const TNT_LAUNCH_DISTANCE = 10;

/** Delay between chain TNT explosions (ms) */
export const TNT_CHAIN_DELAY = 500;

/** Additional blocks launched upward per extra TNT in chain */
export const TNT_CHAIN_EXTRA_LAUNCH = 5;

/** First N blocks from surface/checkpoint are guaranteed TNT-free */
export const SAFE_SPAWN_BLOCKS = 3;

/** Maximum dig actions per second (anti-cheat rate limit) */
export const MAX_DIG_RATE = 10;

/** Grace period for disconnected players before removal (ms) */
export const PLAYER_DISCONNECT_GRACE = 30000;

/** How often to persist dirty chunks to storage (ms) */
export const CHUNK_SAVE_INTERVAL = 30000;

/** Pixels per block in the client renderer */
export const BLOCK_SIZE = 40;

/** Default viewport width in blocks */
export const VIEWPORT_WIDTH = 20;

/** Default viewport height in blocks */
export const VIEWPORT_HEIGHT = 15;

/** Minimum distance between players to send position updates */
export const PLAYER_UPDATE_RADIUS = 50;

/** Gas pocket event: torch blackout duration (ms) */
export const GAS_POCKET_DURATION = 10000;

/** Cave-in event: blocks pushed upward */
export const CAVE_IN_PUSH_DISTANCE = 5;

/** Cave-in event: items lost from inventory */
export const CAVE_IN_ITEMS_LOST = 2;

/** Rock slide event: temporary hardness bonus */
export const ROCK_SLIDE_HARDNESS_BONUS = 3;

/** Rock slide event: duration in blocks dug */
export const ROCK_SLIDE_DURATION_BLOCKS = 20;

/** Random event base trigger chance per block dug */
export const EVENT_BASE_CHANCE = 0.03;

/** Room code length for party matchmaking */
export const ROOM_CODE_LENGTH = 6;

/** Room code TTL in Redis (seconds) */
export const ROOM_CODE_TTL = 86400;
