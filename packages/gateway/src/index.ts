import { createServer } from 'http';
import { EventEmitter } from 'events';

import type { PiRuntimeAdapter } from '@no-pi-no-gang/contracts';

class Gateway {
  private server;
  private port: number = 0;
  private runtimeAdapter: PiRuntimeAdapter;

  constructor(runtimeAdapter?: PiRuntimeAdapter) {
    this.runtimeAdapter = runtimeAdapter || new PiRuntimeAdapter();
    this.server = createServer(this.handleRequest.bind(this));
  }

  private handleRequest(req: any, res: any) {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Gateway OK');
      return;
    }
    if (req.url === '/sse') {
      // basic SSE setup for MVP
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('event: connected\\n\\n');
      // for MVP, simple echo or something
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  }

  async start() {
    return new Promise<number>((resolve, reject) => {
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address() as any;
        this.port = addr.port;
        resolve(this.port);
      });
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }

  getPort() {
    return this.port;
  }
}

export default Gateway;

export class PiRuntimeAdapter implements PiRuntimeAdapter {
  private fixedPiVersion = "0.1.0"; // Phase 0: fixed version

  async startSession(workspaceId: string): Promise<any> {
    // Stub: in real would call Pi Runtime via adapter
    console.log(`[PiAdapter] Starting session for workspace ${workspaceId} with ${this.fixedPiVersion}`);
    return { id: `sess-${Date.now()}`, workspaceId, status: 'available' };
  }

  async createRun(sessionId: string, prompt: string, commandId?: string): Promise<any> {
    if (commandId) {
      console.log(`[PiAdapter] Run with commandId ${commandId} for prompt: ${prompt.slice(0, 50)}...`);
    } else {
      console.log(`[PiAdapter] Create run for session ${sessionId}: ${prompt.slice(0, 50)}...`);
    }
    return { 
      id: `run-${Date.now()}`, 
      sessionId, 
      prompt, 
      runId: `run-${Date.now()}`, 
      commandId,
      status: 'admission',
      createdAt: new Date()
    };
  }

  async cancelRun(runId: string): Promise<void> {
    console.log(`[PiAdapter] Cancel run ${runId}`);
    // real cancel logic here
  }
}
