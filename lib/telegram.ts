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

export interface TelegramDigestParams {
  scanId: string;
  timestamp: string;
  freshJobs: EvaluatedJob[];
  totalSourcesChecked: number;
  healthySourcesCount: number;
  followUpsDue?: Array<{ title?: string; company?: string; status?: string }>;
  closedTrackedAlerts?: Array<{ title?: string; company?: string }>;
}

/**
 * Format a Telegram HTML digest for fresh qualifying roles, follow-up reminders, or scan health summary
 */
export function formatTelegramDigest(params: TelegramDigestParams): string {
  const scanDateStr = new Date(params.timestamp).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  if (params.freshJobs.length === 0) {
    let emptyMsg = `⚡ <b>JOB DISCOVERY PORTAL - RETRIEVAL REPORT</b> ⚡\n\n` +
      `📅 <b>Scan Run:</b> <code>${escapeHtml(params.scanId)}</code> (${escapeHtml(scanDateStr)} IST)\n` +
      `🔍 <b>Status:</b> 0 new qualifying roles matching candidate profile in this run.\n` +
      `🛡️ <b>Source Health:</b> ${params.healthySourcesCount}/${params.totalSourcesChecked} sources responding cleanly.\n\n`;

    if (params.closedTrackedAlerts && params.closedTrackedAlerts.length > 0) {
      emptyMsg += `⚠️ <b>URGENT: TRACKED ROLES CLOSED BY EMPLOYER:</b>\n`;
      params.closedTrackedAlerts.forEach((alert) => {
        emptyMsg += `   • <b>${escapeHtml(alert.title || 'Role')}</b> at <b>${escapeHtml(alert.company || 'Company')}</b> has closed.\n`;
      });
      emptyMsg += `\n`;
    }

    if (params.followUpsDue && params.followUpsDue.length > 0) {
      emptyMsg += `⏰ <b>ACTION REQUIRED: FOLLOW-UPS DUE TODAY:</b>\n`;
      params.followUpsDue.forEach((fu) => {
        emptyMsg += `   • Follow up on <b>${escapeHtml(fu.title || 'Role')}</b> (${escapeHtml(fu.company || 'Company')}) [Status: ${escapeHtml(fu.status || 'applied')}]\n`;
      });
      emptyMsg += `\n`;
    }

    emptyMsg += `<i>Automated 12-hour scanner is active and monitoring direct ATS & RSS feeds.</i>`;
    return emptyMsg;
  }

  let text = `🚀 <b>JOB DISCOVERY PORTAL - ${params.freshJobs.length} NEW TIER A MATCH(ES)</b> 🚀\n\n` +
    `📅 <b>Scan Run:</b> <code>${escapeHtml(params.scanId)}</code> (${escapeHtml(scanDateStr)} IST)\n` +
    `🎯 <b>Top Tier A Openings:</b>\n\n`;

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

  // Phase 3 Alert: Closed Tracked Applications
  if (params.closedTrackedAlerts && params.closedTrackedAlerts.length > 0) {
    text += `⚠️ <b>URGENT: TRACKED ROLES CLOSED BY EMPLOYER:</b>\n`;
    params.closedTrackedAlerts.forEach((alert) => {
      text += `   • <b>${escapeHtml(alert.title || 'Role')}</b> at <b>${escapeHtml(alert.company || 'Company')}</b> has closed.\n`;
    });
    text += `\n`;
  }

  // Phase 3 Reminders: Follow-ups Due
  if (params.followUpsDue && params.followUpsDue.length > 0) {
    text += `⏰ <b>ACTION REQUIRED: FOLLOW-UPS DUE TODAY:</b>\n`;
    params.followUpsDue.forEach((fu) => {
      text += `   • Follow up on <b>${escapeHtml(fu.title || 'Role')}</b> (${escapeHtml(fu.company || 'Company')}) [Status: ${escapeHtml(fu.status || 'applied')}]\n`;
    });
    text += `\n`;
  }

  text += `------------------------------------\n`;
  text += `🛡️ <b>Source Health:</b> ${params.healthySourcesCount}/${params.totalSourcesChecked} feeds operational.\n`;
  text += `📱 View complete pipeline in your Glassmorphic Dashboard.`;

  return text;
}

/**
 * Dispatch Telegram Digest to Bot endpoint or record mock log
 */
export async function sendTelegramDigest(
  params: TelegramDigestParams
): Promise<TelegramDeliveryResult> {
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
