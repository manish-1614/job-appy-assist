import * as cheerio from 'cheerio';
import crypto from 'crypto';

/**
 * Strips HTML tags, scripts, and styles, decodes entities,
 * and formats clean plain text with preserved line breaks.
 */
export function cleanHtmlToText(html: string): string {
  if (!html || typeof html !== 'string') return '';

  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe').remove();

  // Ensure block elements have spacing
  $('p, br, div, li, h1, h2, h3, h4, h5, h6, tr').each((_, el) => {
    $(el).append('\n');
  });

  const rawText = $('body').text() || $.text();

  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Computes deterministic SHA-256 hash of cleaned text content
 */
export function computeContentHash(text: string): string {
  return crypto
    .createHash('sha256')
    .update((text || '').trim())
    .digest('hex');
}
