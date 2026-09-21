/**
 * Structured Digest Generator for Excalidraw whiteboards and Monaco C++ code.
 * Converts visual diagrams and code into semantic text representations.
 */

export interface DiagramDigestResult {
  digest: string;
  hash: string;
  componentCount: number;
  connectionCount: number;
}

export function generateSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Extracts compact semantic digest from Excalidraw scene elements.
 */
export function generateExcalidrawDigest(elements: readonly any[]): DiagramDigestResult {
  if (!elements || !Array.isArray(elements) || elements.length === 0) {
    return {
      digest: 'DIAGRAM: [Empty Whiteboard]',
      hash: 'empty',
      componentCount: 0,
      connectionCount: 0,
    };
  }

  const activeElements = elements.filter((el) => !el.isDeleted);
  const elementMap = new Map<string, any>();
  activeElements.forEach((el) => elementMap.set(el.id, el));

  const components: string[] = [];
  const connections: string[] = [];

  for (const el of activeElements) {
    if (el.type === 'arrow' || el.type === 'line') {
      const startId = el.startBinding?.elementId;
      const endId = el.endBinding?.elementId;
      const startEl = startId ? elementMap.get(startId) : null;
      const endEl = endId ? elementMap.get(endId) : null;

      const startLabel = startEl?.text || startEl?.type || 'Node';
      const endLabel = endEl?.text || endEl?.type || 'Node';

      connections.push(`- "${startLabel}" -> "${endLabel}"`);
    } else if (el.type === 'text') {
      if (!el.containerId) {
        components.push(`- [text] "${el.text}" (x: ${Math.round(el.x)}, y: ${Math.round(el.y)})`);
      }
    } else if (['rectangle', 'diamond', 'ellipse'].includes(el.type)) {
      // Find associated text container if any
      const boundText = activeElements.find(
        (t) => t.type === 'text' && t.containerId === el.id
      );
      const label = boundText?.text || el.id.substring(0, 6);
      components.push(`- [${el.type}] "${label}" (x: ${Math.round(el.x)}, y: ${Math.round(el.y)})`);
    }
  }

  let digest = 'COMPONENTS:\n';
  digest += components.length > 0 ? components.join('\n') : '- (None yet)\n';
  digest += '\nCONNECTIONS:\n';
  digest += connections.length > 0 ? connections.join('\n') : '- (None yet)\n';

  const hash = generateSimpleHash(digest);

  return {
    digest,
    hash,
    componentCount: components.length,
    connectionCount: connections.length,
  };
}

/**
 * Extracts code digest with line count, signature preview, and hash.
 */
export function generateCodeDigest(code: string): { digest: string; hash: string; lines: number } {
  const trimmed = code.trim();
  const lines = trimmed ? trimmed.split('\n').length : 0;
  const hash = generateSimpleHash(trimmed);

  const digest = `C++ CODE (${lines} lines):\n\`\`\`cpp\n${trimmed}\n\`\`\``;
  return { digest, hash, lines };
}
