import WebSocket from 'ws';

interface BotStats {
  connected: number;
  messagesReceived: number;
  messagesSent: number;
  errors: number;
  latencies: number[];
}

interface LoadTestConfig {
  serverUrl: string;
  totalBots: number;
  rampUpMs: number;
  testDurationMs: number;
  actionsPerSecond: number;
}

/**
 * Load testing tool that simulates multiple concurrent player connections.
 * Bots connect, authenticate, join quick play, and perform periodic actions.
 */
export class LoadTest {
  private config: LoadTestConfig;
  private bots: WebSocket[] = [];
  private stats: BotStats = {
    connected: 0,
    messagesReceived: 0,
    messagesSent: 0,
    errors: 0,
    latencies: [],
  };
  private running = false;

  constructor(config: Partial<LoadTestConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl ?? 'ws://localhost:9001',
      totalBots: config.totalBots ?? 50,
      rampUpMs: config.rampUpMs ?? 5000,
      testDurationMs: config.testDurationMs ?? 30000,
      actionsPerSecond: config.actionsPerSecond ?? 2,
    };
  }

  async run(): Promise<void> {
    console.log('[LoadTest] Starting load test...');
    console.log(`  Bots: ${this.config.totalBots}`);
    console.log(`  Ramp-up: ${this.config.rampUpMs}ms`);
    console.log(`  Duration: ${this.config.testDurationMs}ms`);
    console.log(`  Actions/sec per bot: ${this.config.actionsPerSecond}`);

    this.running = true;
    const startTime = Date.now();

    // Ramp up bots
    const interval = this.config.rampUpMs / this.config.totalBots;
    for (let i = 0; i < this.config.totalBots; i++) {
      if (!this.running) break;
      this.spawnBot(i);
      await this.sleep(interval);
    }

    console.log(`[LoadTest] All ${this.config.totalBots} bots spawned`);

    // Wait for test duration
    const remaining = this.config.testDurationMs - (Date.now() - startTime);
    if (remaining > 0) {
      await this.sleep(remaining);
    }

    // Shutdown
    this.running = false;
    this.closeBots();
    this.printReport(Date.now() - startTime);
  }

  private spawnBot(index: number): void {
    try {
      const ws = new WebSocket(this.config.serverUrl);

      ws.on('open', () => {
        this.stats.connected++;
        // Authenticate
        this.send(ws, { type: 'auth' });
        // Start action loop
        this.botActionLoop(ws, index);
      });

      ws.on('message', () => {
        this.stats.messagesReceived++;
      });

      ws.on('error', () => {
        this.stats.errors++;
      });

      ws.on('close', () => {
        this.stats.connected--;
      });

      this.bots.push(ws);
    } catch {
      this.stats.errors++;
    }
  }

  private botActionLoop(ws: WebSocket, _index: number): void {
    const intervalMs = 1000 / this.config.actionsPerSecond;

    const loop = () => {
      if (!this.running || ws.readyState !== WebSocket.OPEN) return;

      const action = Math.random();
      const sendTime = Date.now();

      if (action < 0.5) {
        // Move
        const x = Math.floor(Math.random() * 2000);
        const y = Math.floor(Math.random() * 100);
        this.send(ws, { type: 'move', x, y });
      } else if (action < 0.8) {
        // Dig
        const x = Math.floor(Math.random() * 2000);
        const y = Math.floor(Math.random() * 100) + 1;
        this.send(ws, { type: 'dig', x, y });
      } else {
        // Chat
        this.send(ws, { type: 'chat', message: `Bot message ${Date.now()}` });
      }

      this.stats.latencies.push(Date.now() - sendTime);

      setTimeout(loop, intervalMs);
    };

    // Join quick play first
    this.send(ws, { type: 'join_quick_play' });
    setTimeout(loop, 1000);
  }

  private send(ws: WebSocket, message: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
    }
  }

  private closeBots(): void {
    for (const ws of this.bots) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Test complete');
      }
    }
    this.bots = [];
  }

  private printReport(totalMs: number): void {
    const avgLatency = this.stats.latencies.length > 0
      ? this.stats.latencies.reduce((a, b) => a + b, 0) / this.stats.latencies.length
      : 0;

    const p95Index = Math.floor(this.stats.latencies.length * 0.95);
    const sorted = [...this.stats.latencies].sort((a, b) => a - b);
    const p95 = sorted[p95Index] ?? 0;

    console.log('\n=== Load Test Report ===');
    console.log(`  Duration: ${(totalMs / 1000).toFixed(1)}s`);
    console.log(`  Peak connections: ${this.config.totalBots}`);
    console.log(`  Messages sent: ${this.stats.messagesSent}`);
    console.log(`  Messages received: ${this.stats.messagesReceived}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Avg send latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  P95 send latency: ${p95.toFixed(2)}ms`);
    console.log(`  Throughput: ${(this.stats.messagesSent / (totalMs / 1000)).toFixed(0)} msg/s`);
    console.log('========================\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  stop(): void {
    this.running = false;
    this.closeBots();
  }
}

// CLI runner
if (process.argv[1]?.includes('LoadTest')) {
  const test = new LoadTest({
    totalBots: parseInt(process.argv[2] ?? '50', 10),
    testDurationMs: parseInt(process.argv[3] ?? '30000', 10),
  });

  test.run().catch(console.error);

  process.on('SIGINT', () => {
    test.stop();
    process.exit(0);
  });
}
