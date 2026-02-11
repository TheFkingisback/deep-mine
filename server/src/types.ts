// Re-export all message types from shared package
export type {
  ClientMessage,
  ServerMessage,
  DigMessage,
  MoveMessage,
  CollectItemMessage,
  GoSurfaceMessage,
  SellMessage,
  BuyEquipmentMessage,
  BuyInventoryUpgradeMessage,
  SetCheckpointMessage,
  DescendMessage,
  JoinQuickPlayMessage,
  CreatePartyMessage,
  JoinPartyMessage,
  PlaySoloMessage,
  ClientChatMessage,
  AuthMessage,
  WelcomeMessage,
  WorldChunkMessage,
  BlockUpdateMessage,
  BlockDestroyedMessage,
  RevealBlockMessage,
  ExplosionMessage,
  PlayerStateUpdateMessage,
  EventMessage,
  SellResultMessage,
  BuyResultMessage,
  OtherPlayerUpdateMessage,
  OtherPlayerJoinedMessage,
  OtherPlayerLeftMessage,
  CollectResultMessage,
  InventoryFullMessage,
  MatchmakingResultMessage,
  ChatBroadcastMessage,
  AuthResultMessage,
  ErrorMessage,
} from '@shared/messages';

// ─── Server-side types ──────────────────────────────────────────────

export interface ConnectedPlayer {
  id: string;
  displayName: string;
  ws: import('ws').WebSocket;
  authenticated: boolean;
  shardId: string | null;
  lastActivity: number;
}
