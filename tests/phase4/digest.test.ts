import { describe, it, expect } from 'vitest';
import {
  generateExcalidrawDigest,
  generateCodeDigest,
  generateSimpleHash,
} from '../../lib/interview/digest';

describe('Phase 4: Interview Room Digest Engine', () => {
  describe('1. Simple Hash Utility', () => {
    it('produces deterministic hash for identical strings', () => {
      const h1 = generateSimpleHash('Hello World');
      const h2 = generateSimpleHash('Hello World');
      const h3 = generateSimpleHash('Different Content');

      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
    });
  });

  describe('2. Excalidraw Semantic Digest Generator', () => {
    it('handles empty canvas elements', () => {
      const result = generateExcalidrawDigest([]);
      expect(result.digest).toContain('[Empty Whiteboard]');
      expect(result.componentCount).toBe(0);
      expect(result.connectionCount).toBe(0);
      expect(result.hash).toBe('empty');
    });

    it('filters deleted elements and extracts nodes with labels and coordinates', () => {
      const elements = [
        {
          id: 'node1',
          type: 'rectangle',
          x: 100,
          y: 200,
          isDeleted: false,
        },
        {
          id: 'text1',
          type: 'text',
          containerId: 'node1',
          text: 'API Gateway',
          x: 100,
          y: 200,
          isDeleted: false,
        },
        {
          id: 'node2',
          type: 'diamond',
          x: 300,
          y: 200,
          isDeleted: false,
        },
        {
          id: 'deleted_node',
          type: 'rectangle',
          x: 50,
          y: 50,
          isDeleted: true,
        },
      ];

      const result = generateExcalidrawDigest(elements);
      expect(result.componentCount).toBe(2);
      expect(result.digest).toContain('[rectangle] "API Gateway"');
      expect(result.digest).toContain('[diamond]');
      expect(result.digest).not.toContain('deleted_node');
    });

    it('extracts directional arrow connections between elements', () => {
      const elements = [
        {
          id: 'n1',
          type: 'rectangle',
          text: 'Client',
          x: 50,
          y: 100,
          isDeleted: false,
        },
        {
          id: 'n2',
          type: 'rectangle',
          text: 'Load Balancer',
          x: 200,
          y: 100,
          isDeleted: false,
        },
        {
          id: 'arrow1',
          type: 'arrow',
          startBinding: { elementId: 'n1' },
          endBinding: { elementId: 'n2' },
          isDeleted: false,
        },
      ];

      const result = generateExcalidrawDigest(elements);
      expect(result.connectionCount).toBe(1);
      expect(result.digest).toContain('- "Client" -> "Load Balancer"');
    });
  });

  describe('3. Monaco C++ Code Digest Generator', () => {
    it('extracts formatted code digest with line count and hash', () => {
      const sampleCode = `#include <vector>\nusing namespace std;\n\nint main() {\n  return 0;\n}`;
      const result = generateCodeDigest(sampleCode);

      expect(result.lines).toBe(6);
      expect(result.digest).toContain('C++ CODE (6 lines):');
      expect(result.digest).toContain('```cpp');
      expect(result.hash).toBeTruthy();
    });
  });
});
