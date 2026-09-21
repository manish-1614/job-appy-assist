import { WebSocketServer, WebSocket } from 'ws';
import { INTERVIEW_CONFIG } from '../lib/interview/config';
import { parseClientMessage, serializeServerMessage } from '../lib/interview/protocol';
import { InterviewSessionManager } from '../lib/interview/session-manager';
import { checkBudgetGuard } from '../lib/interview/cost-meter';

const host = INTERVIEW_CONFIG.wsHost;
const port = INTERVIEW_CONFIG.wsPort;

console.log('='.repeat(60));
console.log('🚀 JobAppy Mock-Interview Real-Time WebSocket Proxy Server');
console.log('='.repeat(60));
console.log(`Bound: ws://${host}:${port}`);
console.log(`Live Model: ${INTERVIEW_CONFIG.models.live}`);
console.log(`Observer Model: ${INTERVIEW_CONFIG.models.observer}`);
console.log(`Grader Model: ${INTERVIEW_CONFIG.models.grader}`);

const budget = checkBudgetGuard();
console.log(
  `Budget: INR ${budget.monthlyCostInr} / ${budget.budgetInr} (${budget.percentUsed}%) - Level: ${budget.warningLevel.toUpperCase()}`
);
console.log('='.repeat(60));

const wss = new WebSocketServer({ host, port });

wss.on('connection', (ws: WebSocket, req) => {
  const remoteAddr = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${remoteAddr}`);

  const sessionManager = new InterviewSessionManager(ws);

  ws.on('message', async (data: Buffer | string) => {
    try {
      const raw = data.toString('utf8');
      const msg = parseClientMessage(raw);

      if (!msg) {
        ws.send(
          serializeServerMessage({
            type: 'error',
            code: 'INVALID_MESSAGE',
            message: 'Malformed JSON or unsupported message type',
            fatal: false,
          })
        );
        return;
      }

      await sessionManager.handleMessage(msg);
    } catch (err: any) {
      console.error('[WS] Error processing client message:', err);
      ws.send(
        serializeServerMessage({
          type: 'error',
          code: 'INTERNAL_ERROR',
          message: err?.message || 'Server error',
          fatal: false,
        })
      );
    }
  });

  ws.on('close', async (code, reason) => {
    console.log(`[WS] Client disconnected (${code}, ${reason.toString('utf8')})`);
    await sessionManager.handleSessionEnd('client_disconnected');
  });

  ws.on('error', (err) => {
    console.error('[WS] Socket error:', err);
  });
});

wss.on('listening', () => {
  console.log(`[WS] Listening on ws://${host}:${port} — Ready for interview sessions.\n`);
});

function handleShutdown(signal: string) {
  console.log(`\n[WS] Received ${signal}. Closing all client connections...`);
  wss.close(() => {
    console.log('[WS] WebSocket server shut down cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
