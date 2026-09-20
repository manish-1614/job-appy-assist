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

export function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format a Telegram HTML digest for fresh qualifying roles or scan health summary
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
    return `⚡ <b>JOB DISCOVERY PORTAL - RETRIEVAL REPORT</b> ⚡\n\n` +
      `📅 <b>Scan Run:</b> <code>${escapeHtml(params.scanId)}</code> (${escapeHtml(scanDateStr)} IST)\n` +
      `🔍 <b>Status:</b> 0 new qualifying roles matching candidate profile in this run.\n` +
      `🛡️ <b>Source Health:</b> ${params.healthySourcesCount}/${params.totalSourcesChecked} sources responding cleanly.\n\n` +
      `<i>Automated 12-hour scanner is active and monitoring direct ATS & RSS feeds.</i>`;
  }

  let text = `🚀 <b>JOB DISCOVERY PORTAL - ${params.freshJobs.length} NEW MATCH(ES)</b> 🚀\n\n` +
    `📅 <b>Scan Run:</b> <code>${escapeHtml(params.scanId)}</code> (${escapeHtml(scanDateStr)} IST)\n` +
    `🎯 <b>Fresh Qualifying Openings (Score ≥ 70):</b>\n\n`;

  params.freshJobs.forEach((job, index) => {
    const starGlow = job.score >= 90 ? '🌟' : '✨';
    text += `${index + 1}. ${starGlow} <b>${escapeHtml(job.title)}</b>\n`;
    text += `   🏢 <b>Company:</b> ${escapeHtml(job.company)}\n`;
    text += `   📍 <b>Location:</b> ${escapeHtml(job.location)}\n`;
    text += `   📊 <b>Match Score:</b> <code>${job.score}/100</code> | 💰 ${escapeHtml(job.salary)}\n`;
    text += `   🛂 <b>Sponsorship:</b> <code>${escapeHtml(job.sponsorship.toUpperCase())}</code> | 📡 <b>Source:</b> ${escapeHtml(job.source)}\n`;
    text += `   💡 <b>Why Match:</b> ${escapeHtml(job.matchReason.slice(0, 140))}...\n`;
    text += `   🔗 <a href="${escapeHtml(job.canonicalUrl)}">Apply Directly</a>\n\n`;
  });

  text += `------------------------------------\n`;
  text += `🛡️ <b>Source Health:</b> ${params.healthySourcesCount}/${params.totalSourcesChecked} feeds operational.\n`;
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
        parse_mode: 'HTML',
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
