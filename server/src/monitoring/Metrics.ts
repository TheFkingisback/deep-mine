import http from 'http';

interface MetricGauge {
  name: string;
  value: number;
  help: string;
}

interface MetricCounter {
  name: string;
  value: number;
  help: string;
}

/**
 * Lightweight server metrics collector and HTTP health/metrics endpoint.
 * Exposes Prometheus-compatible /metrics and JSON /health endpoints.
 */
export class Metrics {
  private gauges = new Map<string, MetricGauge>();
  private counters = new Map<string, MetricCounter>();
  private server: http.Server | null = null;
  private startTime = Date.now();

  constructor() {
    this.registerGauge('connected_players', 'Number of connected players', 0);
    this.registerGauge('active_shards', 'Number of active game shards', 0);
    this.registerGauge('memory_heap_mb', 'Heap memory usage in MB', 0);
    this.registerCounter('messages_received', 'Total messages received from clients', 0);
    this.registerCounter('messages_sent', 'Total messages sent to clients', 0);
    this.registerCounter('connections_total', 'Total WebSocket connections', 0);
    this.registerCounter('disconnections_total', 'Total WebSocket disconnections', 0);
    this.registerCounter('auth_success', 'Successful authentications', 0);
    this.registerCounter('auth_failure', 'Failed authentications', 0);
    this.registerCounter('dig_requests', 'Total dig requests processed', 0);
    this.registerCounter('errors_total', 'Total errors', 0);
  }

  registerGauge(name: string, help: string, value: number): void {
    this.gauges.set(name, { name, value, help });
  }

  registerCounter(name: string, help: string, value: number): void {
    this.counters.set(name, { name, value, help });
  }

  setGauge(name: string, value: number): void {
    const gauge = this.gauges.get(name);
    if (gauge) gauge.value = value;
  }

  incrementCounter(name: string, amount = 1): void {
    const counter = this.counters.get(name);
    if (counter) counter.value += amount;
  }

  getGauge(name: string): number {
    return this.gauges.get(name)?.value ?? 0;
  }

  getCounter(name: string): number {
    return this.counters.get(name)?.value ?? 0;
  }

  /**
   * Start HTTP server for health/metrics endpoints.
   */
  startHttpServer(port: number): void {
    this.server = http.createServer((req, res) => {
      if (req.url === '/health') {
        this.handleHealth(res);
      } else if (req.url === '/metrics') {
        this.handleMetrics(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(port, () => {
      console.log(`[Metrics] Health/metrics server on http://localhost:${port}`);
    });
  }

  private handleHealth(res: http.ServerResponse): void {
    const uptime = Date.now() - this.startTime;
    const mem = process.memoryUsage();

    const health = {
      status: 'ok',
      uptime: Math.floor(uptime / 1000),
      players: this.getGauge('connected_players'),
      shards: this.getGauge('active_shards'),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }

  private handleMetrics(res: http.ServerResponse): void {
    // Update memory gauge
    const mem = process.memoryUsage();
    this.setGauge('memory_heap_mb', Math.round(mem.heapUsed / 1024 / 1024));

    let output = '';

    // Gauges
    for (const [, gauge] of this.gauges) {
      output += `# HELP deepmine_${gauge.name} ${gauge.help}\n`;
      output += `# TYPE deepmine_${gauge.name} gauge\n`;
      output += `deepmine_${gauge.name} ${gauge.value}\n`;
    }

    // Counters
    for (const [, counter] of this.counters) {
      output += `# HELP deepmine_${counter.name} ${counter.help}\n`;
      output += `# TYPE deepmine_${counter.name} counter\n`;
      output += `deepmine_${counter.name} ${counter.value}\n`;
    }

    // Uptime
    output += `# HELP deepmine_uptime_seconds Server uptime in seconds\n`;
    output += `# TYPE deepmine_uptime_seconds gauge\n`;
    output += `deepmine_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}\n`;

    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end(output);
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
