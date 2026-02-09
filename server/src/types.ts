import { BlockType, ItemType, EquipmentSlot, EquipmentTier, Position } from '@shared/types';

// ─── Client → Server Messages ───────────────────────────────────────

export interface DigMessage {
  type: 'dig';
  seq: number;
  x: number;
  y: number;
  timestamp: number;
}

export interface MoveMessage {
  type: 'move';
  seq: number;
  x: number;
  y: number;
}

export interface CollectItemMessage {
  type: 'collect_item';
  seq: number;
  itemId: string;
}

export interface GoSurfaceMessage {
  type: 'go_surface';
}

export interface SellMessage {
  type: 'sell';
  items: { itemType: ItemType; quantity: number }[];
}

export interface BuyEquipmentMessage {
  type: 'buy_equipment';
  slot: EquipmentSlot;
  tier: EquipmentTier;
}

export interface BuyInventoryUpgradeMessage {
  type: 'buy_inventory_upgrade';
}

export interface SetCheckpointMessage {
  type: 'set_checkpoint';
  depth: number;
}

export interface DescendMessage {
  type: 'descend';
  checkpoint: number | null;
}

export interface JoinQuickPlayMessage {
  type: 'join_quick_play';
}

export interface CreatePartyMessage {
  type: 'create_party';
  maxPlayers?: number;
}

export interface JoinPartyMessage {
  type: 'join_party';
  roomCode: string;
}

export interface PlaySoloMessage {
  type: 'play_solo';
}

export interface ChatMessage {
  type: 'chat';
  message: string;
}

export interface AuthMessage {
  type: 'auth';
  token: string;
}

export type ClientMessage =
  | DigMessage
  | MoveMessage
  | CollectItemMessage
  | GoSurfaceMessage
  | SellMessage
  | BuyEquipmentMessage
  | BuyInventoryUpgradeMessage
  | SetCheckpointMessage
  | DescendMessage
  | JoinQuickPlayMessage
  | CreatePartyMessage
  | JoinPartyMessage
  | PlaySoloMessage
  | ChatMessage
  | AuthMessage;

// ─── Server → Client Messages ───────────────────────────────────────

export interface WelcomeMessage {
  type: 'welcome';
  playerId: string;
  displayName: string;
  state: {
    gold: number;
    equipment: Record<string, number>;
    inventorySlots: number;
    inventoryLevel: number;
    maxDepthReached: number;
  };
}

export interface WorldChunkMessage {
  type: 'world_chunk';
  chunkY: number;
  blocks: {
    x: number;
    y: number;
    blockType: BlockType;
    hp: number;
    maxHp: number;
  }[];
}

export interface BlockUpdateMessage {
  type: 'block_update';
  x: number;
  y: number;
  newHp: number;
  destroyed: boolean;
  actor: string;
}

export interface BlockDestroyedMessage {
  type: 'block_destroyed';
  x: number;
  y: number;
  actor: string;
  drop: {
    itemId: string;
    itemType: ItemType;
    position: Position;
  } | null;
}

export interface RevealBlockMessage {
  type: 'reveal_block';
  x: number;
  y: number;
  blockType: BlockType;
  hp: number;
  maxHp: number;
}

export interface ExplosionMessage {
  type: 'explosion';
  center: Position;
  radius: number;
  destroyedBlocks: Position[];
  chain: { center: Position; delayMs: number }[];
  goldPenalty: number;
  affectedPlayer: string;
  playerLaunchToY: number;
}

export interface PlayerStateUpdateMessage {
  type: 'player_state_update';
  playerId: string;
  x: number;
  y: number;
  gold: number;
  equipment: Record<string, number>;
  inventory: { itemType: ItemType; quantity: number }[];
  inventorySlots: number;
  maxDepthReached: number;
  isStunned: boolean;
  stunDurationMs: number;
}

export interface EventMessage {
  type: 'event';
  eventType: string;
  affectedPlayer: string;
  data: Record<string, unknown>;
}

export interface SellResultMessage {
  type: 'sell_result';
  itemsSold: { itemType: ItemType; quantity: number; unitPrice: number; total: number }[];
  totalGoldEarned: number;
  newGoldBalance: number;
}

export interface BuyResultMessage {
  type: 'buy_result';
  success: boolean;
  slot?: EquipmentSlot;
  newTier?: EquipmentTier;
  goldSpent: number;
  newGoldBalance: number;
  error?: string;
}

export interface OtherPlayerUpdateMessage {
  type: 'other_player_update';
  playerId: string;
  displayName: string;
  x: number;
  y: number;
  action: 'idle' | 'digging' | 'walking' | 'stunned';
  targetBlock?: Position;
  equipment: Record<string, number>;
}

export interface OtherPlayerJoinedMessage {
  type: 'other_player_joined';
  playerId: string;
  displayName: string;
  x: number;
  y: number;
}

export interface OtherPlayerLeftMessage {
  type: 'other_player_left';
  playerId: string;
}

export interface CollectResultMessage {
  type: 'collect_result';
  success: boolean;
  itemId: string;
  itemType?: ItemType;
  quantity?: number;
  error?: string;
}

export interface InventoryFullMessage {
  type: 'inventory_full';
  itemType: ItemType;
}

export interface MatchmakingResultMessage {
  type: 'matchmaking_result';
  success: boolean;
  shardId?: string;
  roomCode?: string;
  error?: string;
}

export interface ChatBroadcastMessage {
  type: 'chat_message';
  playerId: string;
  displayName: string;
  message: string;
  timestamp: number;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export type ServerMessage =
  | WelcomeMessage
  | WorldChunkMessage
  | BlockUpdateMessage
  | BlockDestroyedMessage
  | RevealBlockMessage
  | ExplosionMessage
  | PlayerStateUpdateMessage
  | EventMessage
  | SellResultMessage
  | BuyResultMessage
  | OtherPlayerUpdateMessage
  | OtherPlayerJoinedMessage
  | OtherPlayerLeftMessage
  | CollectResultMessage
  | InventoryFullMessage
  | MatchmakingResultMessage
  | ChatBroadcastMessage
  | ErrorMessage;

// ─── Server-side types ──────────────────────────────────────────────

export interface ConnectedPlayer {
  id: string;
  displayName: string;
  ws: import('ws').WebSocket;
  authenticated: boolean;
  shardId: string | null;
  lastActivity: number;
}
