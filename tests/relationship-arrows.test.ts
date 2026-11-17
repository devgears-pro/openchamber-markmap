import type { Anchor, GraphEdge, NodeContext } from '@markmap/core';
import { applyCommand, EditError } from '@markmap/edit';
import {
  labelText,
  parseDocument,
  validateConventions,
  type Document,
  type EditNode,
} from '@markmap/model';
import {
  classicTheme,
  computeRelationCurve,
  renderRelationEdges,
  sideVector,
  type DrawNode,
} from '@markmap/render';
import { describe, expect, test } from 'vitest';

import { ensureChatStyles } from '../src/chat/styles';
import { ensureStyles, STYLE_ID } from '../src/ui/styles';

const findNode = (doc: Document, label: string): EditNode => {
  for (const id of doc.order) {
    const node = doc.nodes.get(id);
    if (node !== undefined && labelText(doc, node) === label) return node;
  }
  throw new Error(`Missing node ${label}`);
};

const makeDrawNode = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  folded = false,
): DrawNode => {
  const ctx: NodeContext = {
    depth: 1,
    path: [id],
    branch: 0,
    hasChildren: false,
    folded,
    direction: 'right',
  };
  return {
    node: { id, type: 'node', content: [], children: [], notes: [], data: {} },
    rect: { x, y, width, height },
    presence: 1,
    ctx,
    text: {
      runs: [],
      primitives: [],
      lines: 1,
      width,
      height,
    },
  };
};

describe('R-37 relationship arrows', () => {
  test('[R-37] computes side vectors for all cardinal directions', () => {
    expect(sideVector('left')).toEqual({ x: -1, y: 0 });
    expect(sideVector('right')).toEqual({ x: 1, y: 0 });
    expect(sideVector('top')).toEqual({ x: 0, y: -1 });
    expect(sideVector('bottom')).toEqual({ x: 0, y: 1 });
  });

  test('[R-37] computes cubic Bezier curve points, arrowheads, and midpoints', () => {
    const p0: Anchor = { x: 100, y: 50, side: 'right' };
    const p3: Anchor = { x: 300, y: 50, side: 'left' };
    const curve = computeRelationCurve(p0, p3, 'right', 'left');

    expect(curve.p0).toEqual(p0);
    expect(curve.p3).toEqual(p3);
    expect(curve.p1.x).toBeGreaterThan(p0.x);
    expect(curve.p2.x).toBeLessThan(p3.x);
    expect(curve.midX).toBe(200);
    expect(curve.midY).toBe(50);
    expect(curve.d).toContain('M100,50C');
    expect(curve.arrowD).toContain('M300,50L');
  });

  test('[R-37] handles coincident anchors without NaN or infinite values', () => {
    const p0: Anchor = { x: 100, y: 100, side: 'right' };
    const p3: Anchor = { x: 100, y: 100, side: 'right' };
    const curve = computeRelationCurve(p0, p3, 'right', 'right');

    expect(Number.isNaN(curve.angle)).toBe(false);
    expect(Number.isFinite(curve.midX)).toBe(true);
    expect(Number.isFinite(curve.midY)).toBe(true);
  });

  test('[R-37] renders relation primitives with curves, arrowheads, and labels', () => {
    const sourceNode = makeDrawNode('node-a', 0, 0, 100, 40);
    const targetNode = makeDrawNode('node-b', 200, 0, 100, 40);
    const nodesById = new Map<string, DrawNode>([
      ['node-a', sourceNode],
      ['node-b', targetNode],
    ]);
    const identities = new Map<string, string>([
      ['a', 'node-a'],
      ['b', 'node-b'],
    ]);
    const edges: GraphEdge[] = [{ from: 'a', to: 'b', label: 'depends' }];

    const primitives = renderRelationEdges({
      edges,
      identities,
      nodesById,
      theme: classicTheme,
    });

    expect(primitives).toHaveLength(1);
    const group = primitives[0];
    if (group?.kind !== 'group') throw new Error('Expected group');
    expect(group.key).toBe('relation:a:b');
    expect(group.children.length).toBeGreaterThanOrEqual(4);
  });

  test('[R-37] adapts anchor orientation when vertical distance exceeds horizontal distance', () => {
    const sourceNode = makeDrawNode('node-a', 0, 0, 100, 40);
    const targetNode = makeDrawNode('node-b', 0, 200, 100, 40);
    const nodesById = new Map<string, DrawNode>([
      ['node-a', sourceNode],
      ['node-b', targetNode],
    ]);
    const edges: GraphEdge[] = [{ from: 'node-a', to: 'node-b', label: null }];

    const primitives = renderRelationEdges({
      edges,
      nodesById,
      theme: classicTheme,
    });

    expect(primitives).toHaveLength(1);
    const group = primitives[0];
    if (group?.kind !== 'group') throw new Error('Expected group');
    expect(group.children).toHaveLength(2);
  });

  test('[R-37] resolves root node when from or to is root', () => {
    const rootNode = makeDrawNode('root-id', 0, 0, 100, 40);
    const childNode = makeDrawNode('child-id', 200, 0, 100, 40);
    const nodesById = new Map<string, DrawNode>([
      ['root-id', rootNode],
      ['child-id', childNode],
    ]);
    const identities = new Map<string, string>([['c', 'child-id']]);
    const edges: GraphEdge[] = [
      { from: 'root', to: 'c', label: null },
      { from: 'c', to: 'root', label: null },
    ];

    const primitives = renderRelationEdges({
      edges,
      identities,
      nodesById,
      rootId: 'root-id',
      theme: classicTheme,
    });

    expect(primitives).toHaveLength(2);
  });

  test('[R-37] hides relationship arrows when an endpoint node is folded', () => {
    const sourceNode = makeDrawNode('node-a', 0, 0, 100, 40);
    const targetNode = makeDrawNode('node-b', 200, 0, 100, 40);
    const nodesById = new Map<string, DrawNode>([
      ['node-a', sourceNode],
      ['node-b', targetNode],
    ]);
    const edges: GraphEdge[] = [{ from: 'node-a', to: 'node-b', label: 'hidden' }];

    const foldedBySet = renderRelationEdges({
      edges,
      nodesById,
      folded: new Set(['node-a']),
      theme: classicTheme,
    });
    expect(foldedBySet).toHaveLength(0);

    const foldedTarget = makeDrawNode('node-c', 200, 0, 100, 40, true);
    const nodesWithFoldedCtx = new Map<string, DrawNode>([
      ['node-a', sourceNode],
      ['node-c', foldedTarget],
    ]);
    const foldedByCtx = renderRelationEdges({
      edges: [{ from: 'node-a', to: 'node-c', label: null }],
      nodesById: nodesWithFoldedCtx,
      theme: classicTheme,
    });
    expect(foldedByCtx).toHaveLength(0);
  });

  test('[R-37] skips rendering when endpoint nodes are missing from map', () => {
    const sourceNode = makeDrawNode('node-a', 0, 0, 100, 40);
    const nodesById = new Map<string, DrawNode>([['node-a', sourceNode]]);
    const edges: GraphEdge[] = [{ from: 'node-a', to: 'missing', label: null }];

    const primitives = renderRelationEdges({
      edges,
      nodesById,
      theme: classicTheme,
    });
    expect(primitives).toHaveLength(0);
  });

  test('[R-37] creates directed relationship edges and mints missing identities', () => {
    const source = '# Root\n\n- Alpha\n- Beta\n';
    const parsed = parseDocument(source);
    const alpha = findNode(parsed.document, 'Alpha');
    const beta = findNode(parsed.document, 'Beta');

    const result = applyCommand(parsed.document, {
      type: 'createEdge',
      from: alpha.id,
      to: beta.id,
      label: 'links',
      random: () => 0,
    });

    expect(result.document.graph.edges).toHaveLength(1);
    const edge = result.document.graph.edges[0];
    if (edge === undefined) throw new Error('Missing edge');
    expect(edge.label).toBe('links');
    expect(result.document.source).toContain('<!-- markmap: graph');
    expect(result.document.source).toContain('links');
    expect(validateConventions(result.document)).toEqual([]);
  });

  test('[R-37] creates directed edge to root without minting identity on root', () => {
    const source = '# Root\n\n- Alpha <!-- ^a -->\n';
    const parsed = parseDocument(source);
    const alpha = findNode(parsed.document, 'Alpha');

    const result = applyCommand(parsed.document, {
      type: 'createEdge',
      from: alpha.id,
      to: 'root',
      label: null,
    });

    expect(result.document.graph.edges).toHaveLength(1);
    const edge = result.document.graph.edges[0];
    if (edge === undefined) throw new Error('Missing edge');
    expect(edge.from).toBe('a');
    expect(edge.to).toBe('root');
    expect(edge.label).toBeNull();
    expect(result.document.nodes.get(result.document.root)?.identity?.id).toBe('root');
    expect(result.document.source).not.toContain('# Root <!-- ^');
  });

  test('[R-37] rejects duplicate edge or non-existent endpoint nodes', () => {
    const source =
      '# Root\n\n- A <!-- ^a -->\n- B <!-- ^b -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: b\n-->\n';
    const parsed = parseDocument(source);
    const a = findNode(parsed.document, 'A');
    const b = findNode(parsed.document, 'B');

    expect(() =>
      applyCommand(parsed.document, {
        type: 'createEdge',
        from: a.id,
        to: b.id,
      }),
    ).toThrow(EditError);

    expect(() =>
      applyCommand(parsed.document, {
        type: 'createEdge',
        from: a.id,
        to: 'unknown-id',
      }),
    ).toThrow(EditError);
  });

  test('[R-37] updates, clears, and validates edge labels with setEdgeLabel', () => {
    const source =
      '# Root\n\n- A <!-- ^a -->\n- B <!-- ^b -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: b\n    label: initial\n-->\n';
    const parsed = parseDocument(source);

    const updated = applyCommand(parsed.document, {
      type: 'setEdgeLabel',
      from: 'a',
      to: 'b',
      label: 'updated',
    });
    expect(updated.document.graph.edges[0]?.label).toBe('updated');
    expect(updated.document.source).toContain('updated');

    const cleared = applyCommand(updated.document, {
      type: 'setEdgeLabel',
      from: 'a',
      to: 'b',
      label: '   ',
    });
    expect(cleared.document.graph.edges[0]?.label).toBeNull();

    expect(() =>
      applyCommand(parsed.document, {
        type: 'setEdgeLabel',
        from: 'a',
        to: 'b',
        label: 'invalid <!-- comment -->',
      }),
    ).toThrow(EditError);
  });

  test('[R-37] deletes directed edges and purges unreferenced node identities', () => {
    const source =
      '# Root\n\n- A <!-- ^a -->\n- B <!-- ^b -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: b\n-->\n';
    const parsed = parseDocument(source);

    const result = applyCommand(parsed.document, {
      type: 'deleteEdge',
      from: 'a',
      to: 'b',
    });

    expect(result.document.graph.edges).toHaveLength(0);
    expect(result.document.source).not.toContain('<!-- markmap: graph');
    expect(result.document.source).not.toContain('<!-- ^a -->');
    expect(result.document.source).not.toContain('<!-- ^b -->');
    expect(validateConventions(result.document)).toEqual([]);
  });

  test('[R-37] styles relation edge and label tokens in stylesheets', () => {
    const doc = document.implementation.createHTMLDocument('test');
    ensureStyles(doc);
    const styleEl = doc.getElementById(STYLE_ID);
    if (styleEl === null) throw new Error('Missing styles');
    expect(styleEl.textContent).toContain('--mm-edge-relation:');
    expect(styleEl.textContent).toContain('--mm-edge-relation-label:');

    const chatDoc = document.implementation.createHTMLDocument('chat-test');
    ensureChatStyles(chatDoc);
    const chatStyleEl = chatDoc.getElementById('markmap-chat-styles');
    if (chatStyleEl === null) throw new Error('Missing chat styles');
    expect(chatStyleEl.textContent).toContain('--mm-edge-relation:');
    expect(chatStyleEl.textContent).toContain('--mm-edge-relation-label:');
  });
});
