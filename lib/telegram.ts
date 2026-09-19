/**
 * Telegram Notification Bot Integration Engine
 */
import { EvaluatedJob } from './ats-adapters';

export interface TelegramDeliveryResult {
  sent: boolean;
  messageId?: string;
  isMock: boolean;
  freshRolesCount: number;
  reason?: string;
  payloadText: string;
}

/**
 * Format a Telegram Markdown digest for fresh qualifying roles or scan health summary
 */
export function formatTelegramDigest(params: {
  scanId: string;
  timestamp: string;
  freshJobs: EvaluatedJob[];
  totalSourcesChecked: number;
  healthySourcesCount: number;
}): string {
  const scanDateStr = new Date(params.timestamp).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  if (params.freshJobs.length === 0) {
    return `⚡ *JOB DISCOVERY PORTAL - RETRIEVAL REPORT* ⚡\n\n` +
      `📅 *Scan Run:* \`${params.scanId}\` (${scanDateStr} IST)\n` +
      `🔍 *Status:* 0 new qualifying roles matching candidate profile in this run.\n` +
      `🛡️ *Source Health:* ${params.healthySourcesCount}/${params.totalSourcesChecked} sources responding cleanly.\n\n` +
      `_Automated 12-hour scanner is active and monitoring direct ATS & RSS feeds._`;
  }

  let text = `🚀 *JOB DISCOVERY PORTAL - ${params.freshJobs.length} NEW MATCH(ES)* 🚀\n\n` +
    `📅 *Scan Run:* \`${params.scanId}\` (${scanDateStr} IST)\n` +
    `🎯 *Fresh Qualifying Openings (Score ≥ 70):*\n\n`;

  params.freshJobs.forEach((job, index) => {
    const starGlow = job.score >= 90 ? '🌟' : '✨';
    text += `${index + 1}. ${starGlow} *${job.title}*\n`;
    text += `   🏢 *Company:* ${job.company}\n`;
    text += `   📍 *Location:* ${job.location}\n`;
    text += `   📊 *Match Score:* \`${job.score}/100\` | 💰 ${job.salary}\n`;
    text += `   🛂 *Sponsorship:* \`${job.sponsorship.toUpperCase()}\` | 📡 *Source:* ${job.source}\n`;
    text += `   💡 *Why Match:* ${job.matchReason.slice(0, 140)}...\n`;
    text += `   🔗 [Apply Directly](${job.canonicalUrl})\n\n`;
  });

  text += `------------------------------------\n`;
  text += `🛡️ *Source Health:* ${params.healthySourcesCount}/${params.totalSourcesChecked} feeds operational.\n`;
  text += `📱 View complete candidate breakdown in your Glassmorphic Dashboard.`;

  return text;
}

/**
 * Dispatch Telegram Digest to Bot endpoint or record mock log
 */
export async function sendTelegramDigest(params: {
  scanId: string;
  timestamp: string;
  freshJobs: EvaluatedJob[];
  totalSourcesChecked: number;
  healthySourcesCount: number;
}): Promise<TelegramDeliveryResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const payloadText = formatTelegramDigest(params);

  if (!botToken || !chatId) {
    console.log('[Telegram Digest Mock] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set. Payload generated:\n', payloadText);
    return {
      sent: true,
      isMock: true,
      freshRolesCount: params.freshJobs.length,
      reason: 'Mock Delivery (Set TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID for live Telegram alerts)',
      payloadText
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: payloadText,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      console.error('[Telegram API Error]', data);
      return {
        sent: false,
        isMock: false,
        freshRolesCount: params.freshJobs.length,
        reason: data.description || 'Telegram API call failed',
        payloadText
      };
    }

    return {
      sent: true,
      messageId: String(data.result?.message_id || 'sent'),
      isMock: false,
      freshRolesCount: params.freshJobs.length,
      payloadText
    };
  } catch (err: any) {
    console.error('[Telegram Send Exception]', err);
    return {
      sent: false,
      isMock: false,
      freshRolesCount: params.freshJobs.length,
      reason: err.message || 'Network failure dispatching Telegram digest',
      payloadText
    };
  }
}
