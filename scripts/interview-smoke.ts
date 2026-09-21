import { WebSocketServer, WebSocket } from 'ws';
import { INTERVIEW_CONFIG } from '../lib/interview/config';
import {
  parseClientMessage,
  serializeServerMessage,
  ServerMessage,
} from '../lib/interview/protocol';
import { InterviewSessionManager } from '../lib/interview/session-manager';
import { sqlite } from '../lib/db';

async function runSmokeTest() {
  console.log('='.repeat(60));
  console.log('🧪 Starting Mock-Interview Server Smoke Test');
  console.log('='.repeat(60));

  const testPort = 4009; // dedicated port for smoke test
  let wss: WebSocketServer | null = null;

  try {
    // 1. Spin up test WS server
    wss = new WebSocketServer({ host: '127.0.0.1', port: testPort });
    wss.on('connection', (ws) => {
      const mgr = new InterviewSessionManager(ws, true); // Mock mode for deterministic smoke test
      ws.on('message', async (data) => {
        const raw = data.toString('utf8');
        const parsed = parseClientMessage(raw);
        if (parsed) {
          await mgr.handleMessage(parsed);
        }
      });
      ws.on('close', async () => {
        await mgr.handleSessionEnd('client_closed');
      });
    });

    await new Promise<void>((resolve) => wss!.on('listening', () => resolve()));
    console.log(`✓ Smoke server listening on ws://127.0.0.1:${testPort}`);

    // 2. Connect client WebSocket
    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);
    const receivedMessages: ServerMessage[] = [];

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
    });
    console.log('✓ Client connected to smoke server');

    client.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString('utf8')) as ServerMessage;
        receivedMessages.push(msg);
      } catch (err) {
        console.warn('Could not parse server message:', err);
      }
    });

    // 3. Send session.start
    const testSessionId = `smoke_${Date.now()}`;
    client.send(
      JSON.stringify({
        type: 'session.start',
        sessionId: testSessionId,
        companyStyle: 'google',
        roundType: 'system_design',
        questionId: 'sys_flash_sale',
        candidateProfile: { name: 'Manish Kumar Prajapati', yearsExperience: 8.5 },
      })
    );

    // Wait for session.ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for session.ready')), 5000);
      const interval = setInterval(() => {
        const ready = receivedMessages.find((m) => m.type === 'session.ready');
        if (ready) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
    console.log('✓ Received session.ready');

    // 4. Send artifact.update (Excalidraw diagram digest)
    client.send(
      JSON.stringify({
        type: 'artifact.update',
        kind: 'diagram',
        contentHash: 'hash_test_123',
        contentText: 'COMPONENTS:\n- API Gateway\n- Redis Cluster\n- Kafka Queue',
      })
    );
    console.log('✓ Sent artifact.update');

    // 5. Send synthetic audio.chunk (16kHz PCM mono)
    const syntheticPcm = Buffer.alloc(3200); // 100ms at 16kHz 16-bit
    client.send(
      JSON.stringify({
        type: 'audio.chunk',
        pcm16Base64: syntheticPcm.toString('base64'),
      })
    );
    console.log('✓ Sent audio.chunk');

    // Wait for initial transcript & audio output
    await new Promise<void>((resolve) => setTimeout(resolve, 800));

    // 6. Send session.end
    client.send(
      JSON.stringify({
        type: 'session.end',
        reason: 'smoke_complete',
      })
    );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for session.ended')), 5000);
      const interval = setInterval(() => {
        const ended = receivedMessages.find((m) => m.type === 'session.ended');
        if (ended) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
    console.log('✓ Received session.ended');

    client.close();

    // 7. Verify SQLite records
    const sessionRow = sqlite
      .prepare(`SELECT * FROM interview_sessions WHERE id = ?`)
      .get(testSessionId) as any;
    if (!sessionRow || sessionRow.status !== 'completed') {
      throw new Error(`Session DB check failed: ${JSON.stringify(sessionRow)}`);
    }
    console.log(`✓ DB Verification: session status '${sessionRow.status}', question '${sessionRow.question_id}'`);

    const turnsCount = sqlite
      .prepare(`SELECT count(*) as cnt FROM interview_turns WHERE session_id = ?`)
      .get(testSessionId) as any;
    console.log(`✓ DB Verification: recorded ${turnsCount.cnt} turns`);

    const snapCount = sqlite
      .prepare(`SELECT count(*) as cnt FROM interview_snapshots WHERE session_id = ?`)
      .get(testSessionId) as any;
    if (snapCount.cnt !== 1) {
      throw new Error(`Expected 1 snapshot, found ${snapCount.cnt}`);
    }
    console.log(`✓ DB Verification: recorded ${snapCount.cnt} snapshot`);

    console.log('='.repeat(60));
    console.log('🎉 ALL SMOKE TESTS PASSED CLEANLY');
    console.log('='.repeat(60));
  } finally {
    if (wss) {
      wss.close();
    }
  }
}

runSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Smoke test failed:', err);
    process.exit(1);
  });
