import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { ClientMessage, ConnectedPlayer } from './types.js';

const PORT = Number(process.env.PORT) || 9001;

const wss = new WebSocketServer({ port: PORT });
const players = new Map<string, ConnectedPlayer>();

console.log(`[Deep Mine Server] Starting on port ${PORT}...`);

wss.on('listening', () => {
  console.log(`[Deep Mine Server] WebSocket server listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws: WebSocket) => {
  const playerId = uuidv4();
  const player: ConnectedPlayer = {
    id: playerId,
    displayName: '',
    ws,
    authenticated: false,
    shardId: null,
    lastActivity: Date.now(),
  };

  players.set(playerId, player);
  console.log(`[Connect] Player ${playerId} connected (${players.size} total)`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      player.lastActivity = Date.now();
      console.log(`[Message] ${playerId} -> ${message.type}`);

      // Message handling will be expanded in later phases
      handleMessage(player, message);
    } catch (err) {
      console.error(`[Error] Invalid message from ${playerId}:`, err);
      sendError(ws, 'INVALID_MESSAGE', 'Could not parse message');
    }
  });

  ws.on('close', () => {
    console.log(`[Disconnect] Player ${playerId} disconnected (${players.size - 1} remaining)`);
    players.delete(playerId);
  });

  ws.on('error', (err) => {
    console.error(`[Error] Player ${playerId}:`, err.message);
  });
});

function handleMessage(player: ConnectedPlayer, message: ClientMessage): void {
  switch (message.type) {
    case 'auth':
      // Auth will be implemented in P3_S10
      console.log(`[Auth] Player ${player.id} attempting authentication`);
      break;
    case 'dig':
    case 'move':
    case 'collect_item':
    case 'go_surface':
    case 'sell':
    case 'buy_equipment':
    case 'buy_inventory_upgrade':
    case 'set_checkpoint':
    case 'descend':
    case 'join_quick_play':
    case 'create_party':
    case 'join_party':
    case 'play_solo':
    case 'chat':
      // These will be handled by GameLoop/ShardManager in later phases
      break;
    default:
      sendError(player.ws, 'UNKNOWN_TYPE', `Unknown message type`);
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'error', code, message }));
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Shutdown] Closing server...');
  wss.clients.forEach((client) => {
    client.close(1001, 'Server shutting down');
  });
  wss.close(() => {
    console.log('[Shutdown] Server closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[Shutdown] SIGTERM received, closing...');
  wss.close(() => process.exit(0));
});
