import * as edit from '@markmap/edit';
import * as model from '@markmap/model';
import { describe, expect, test } from 'vitest';

import type { Document, EditNode } from '@markmap/model';

const find = (doc: Document, label: string): EditNode => {
  for (const id of doc.order) {
    const node = doc.nodes.get(id);
    if (node !== undefined && model.labelText(doc, node) === label) return node;
  }
  throw new Error(`No node labelled ${label}`);
};

const nodeAtOrder = (doc: Document, index: number): EditNode => {
  const id = doc.order[index];
  const node = id === undefined ? undefined : doc.nodes.get(id);
  if (node === undefined) throw new Error(`No node at order ${index}`);
  return node;
};

const codes = (doc: Document): string[] =>
  model.validateConventions(doc).map((issue) => issue.code);

const graphBlocks = (source: string): number =>
  source.match(/<!--\s*markmap:\s*graph\b/g)?.length ?? 0;

const random = (): number => 0;

const DOC = `# Root

- Group
  - A <!-- ^a -->
  - B <!-- ^b -->
- Target

<!-- markmap: graph
edges:
  - from: a
    to: b
    label: depends
groups:
  - roots: [a]
    label: Delivery
-->
`;

describe('R-34 identity markers', () => {
  test('[R-34] parses a trailing marker as a node identity', () => {
    const source = `# Root\n\n- A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`;
    const doc = model.parseDocument(source).document;
    const node = find(doc, 'A');
    expect(node.identity?.id).toBe('a');
    expect(node.identity?.range).not.toBeNull();
    expect(model.labelText(doc, node)).toBe('A');
    expect(doc.nodes.get(doc.root)?.identity?.id).toBe('root');
    expect(doc.nodes.get(doc.root)?.identity?.range).toBeNull();
    expect(model.validateConventions(doc)).toEqual([]);
  });

  test('[R-34] gives a title or synthetic root the implicit root identity', () => {
    for (const source of ['---\ntitle: Root\n---\n\n- A\n', '- A\n']) {
      const doc = model.parseDocument(source).document;
      expect(doc.nodes.get(doc.root)?.identity).toEqual({ id: 'root', range: null });
      expect(model.validateConventions(doc)).toEqual([]);
    }
  });

  test('[R-34] accepts the marker without spaces and with trailing spaces', () => {
    const source = `# Root\n\n- A<!--^A9-->   \r\n\r\n<!-- markmap: graph\r\nedges:\r\n  - from: A9\r\n    to: root\r\n-->\r\n`;
    const doc = model.parseDocument(source).document;
    expect(find(doc, 'A').identity?.id).toBe('A9');
    expect(model.validateConventions(doc)).toEqual([]);
  });

  test('[R-34] rejects a marker that spans more than one line', () => {
    const doc = model.parseDocument('# Root\n\n- A <!-- ^a\n -->\n').document;
    expect(find(doc, 'A').identity).toBeNull();
    expect(
      model
        .validateConventions(doc)
        .map((issue) => issue.message)
        .join(' '),
    ).toMatch(/one line/i);
  });

  test('[R-34] rejects a marker that is not the final token', () => {
    const source = `# Root\n\n- A <!-- ^a --> more\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`;
    const doc = model.parseDocument(source).document;
    expect(nodeAtOrder(doc, 1).identity).toBeNull();
    expect(codes(doc)).toContain('E_IDENTITY');
  });

  test('[R-34] rejects two markers on one line', () => {
    const source = `# Root\n\n- A <!-- ^a --> <!-- ^b -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`;
    const doc = model.parseDocument(source).document;
    expect(nodeAtOrder(doc, 1).identity).toBeNull();
    expect(
      model
        .validateConventions(doc)
        .map((issue) => issue.message)
        .join(' '),
    ).toMatch(/one marker/i);
  });

  test('[R-34] rejects a standalone marker', () => {
    const source = `# Root\n\n<!-- ^a -->\n\n- A\n`;
    const doc = model.parseDocument(source).document;
    expect(codes(doc)).toContain('E_IDENTITY');
    expect(doc.identities.has('a')).toBe(false);
  });

  test('[R-34] rejects a marker in a note fence and frontmatter', () => {
    const fence = model.parseDocument(
      `# Root\n\n- A\n\n  \`\`\`\n  <!-- ^a -->\n  \`\`\`\n`,
    ).document;
    expect(codes(fence)).toContain('E_IDENTITY');
    const frontmatter = model.parseDocument(
      `---\ntitle: "<!-- ^a -->"\n---\n\n# Root\n\n- A\n`,
    ).document;
    expect(codes(frontmatter)).toContain('E_IDENTITY');
  });

  test('[R-34] rejects a marker on the source-heading root', () => {
    const source = `# Root <!-- ^a -->\n\n- A\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`;
    const doc = model.parseDocument(source).document;
    expect(doc.nodes.get(doc.root)?.identity).toEqual({ id: 'root', range: null });
    expect(codes(doc)).toContain('E_IDENTITY');
  });

  test('[R-34] rejects malformed and duplicate identities', () => {
    for (const marker of ['<!-- ^abcd -->', '<!-- ^a-b -->', '<!-- ^ -->']) {
      const doc = model.parseDocument(`# Root\n\n- A ${marker}\n`).document;
      expect(find(doc, 'A').identity).toBeNull();
      expect(codes(doc)).toContain('E_IDENTITY');
    }
    const duplicate = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n- B <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`,
    ).document;
    expect(codes(duplicate)).toContain('E_IDENTITY');
  });

  test('[R-34] treats the id colon form as a comparison candidate only', () => {
    const source = `# Root\n\n- A <!-- id:a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`;
    const doc = model.parseDocument(source).document;
    expect(find(doc, 'A').identity).toBeNull();
    expect(doc.identities.has('a')).toBe(false);
    expect(codes(doc)).toContain('E_GRAPH');
  });

  test('[R-34] rejects an identity that no edge or group references', () => {
    const doc = model.parseDocument(`# Root\n\n- A <!-- ^a -->\n- B\n`).document;
    expect(codes(doc)).toContain('E_IDENTITY');
  });
});

describe('R-34 graph metadata', () => {
  test('[R-34] parses edges, groups, identities, and leaves no note', () => {
    const parsed = model.parseDocument(DOC);
    const doc = parsed.document;
    expect(doc.graph.edges).toEqual([{ from: 'a', to: 'b', label: 'depends' }]);
    expect(doc.graph.groups).toEqual([{ roots: ['a'], label: 'Delivery' }]);
    expect(doc.identities.get('a')).toBe(find(doc, 'A').id);
    expect(graphBlocks(doc.source)).toBe(1);
    expect(parsed.tree.notes).toHaveLength(0);
    for (const id of doc.order) expect(doc.nodes.get(id)?.notes).toEqual([]);
    expect(model.validateConventions(doc)).toEqual([]);
  });

  test('[R-34] rejects duplicate and misplaced graph blocks', () => {
    const block = `<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`;
    const duplicate = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n${block}\n${block}`,
    ).document;
    expect(codes(duplicate)).toContain('E_GRAPH');
    const fenced = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n\`\`\`\n${block}\`\`\`\n`,
    ).document;
    expect(codes(fenced)).toContain('E_GRAPH');
    const nested = model.parseDocument(`# Root\n\n- A\n  ${block}`).document;
    expect(codes(nested)).toContain('E_GRAPH');
  });

  test('[R-34] reports malformed YAML without throwing or becoming a note', () => {
    const doc = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n<!-- markmap: graph\nedges: [\n-->\n`,
    ).document;
    expect(codes(doc)).toContain('E_GRAPH');
    expect(doc.graph.edges).toEqual([]);
    expect(doc.nodes.get(doc.root)?.notes).toEqual([]);
  });

  test('[R-34] rejects dangling edges, empty groups, and repeated roots', () => {
    const dangling = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: z\n-->\n`,
    ).document;
    expect(codes(dangling)).toContain('E_GRAPH');
    const empty = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\ngroups:\n  - roots: []\n-->\n`,
    ).document;
    expect(codes(empty)).toContain('E_GRAPH');
    const repeated = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\ngroups:\n  - roots: [a, a]\n-->\n`,
    ).document;
    expect(codes(repeated)).toContain('E_GRAPH');
    const across = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\ngroups:\n  - roots: [a]\n  - roots: [a]\n-->\n`,
    ).document;
    expect(codes(across)).toContain('E_GRAPH');
  });

  test('[R-34] rejects self-loop edges', () => {
    const doc = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: a\n-->\n`,
    ).document;
    expect(codes(doc)).toContain('E_GRAPH');
    expect(
      model
        .validateConventions(doc)
        .map((issue) => issue.message)
        .join(' '),
    ).toMatch(/itself/i);
  });

  test('[R-34] rejects duplicate edges', () => {
    const doc = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n- B <!-- ^b -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: b\n  - from: a\n    to: b\n-->\n`,
    ).document;
    expect(codes(doc)).toContain('E_GRAPH');
    expect(
      model
        .validateConventions(doc)
        .map((issue) => issue.message)
        .join(' '),
    ).toMatch(/duplicate/i);
  });

  test('[R-34] rejects overlapping group subtrees', () => {
    const doc = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n  - B <!-- ^b -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\ngroups:\n  - roots: [a]\n  - roots: [b]\n-->\n`,
    ).document;
    expect(
      model
        .validateConventions(doc)
        .map((issue) => issue.message)
        .join(' '),
    ).toMatch(/overlap/i);
  });

  test('[R-34] rejects unsafe HTML delimiters and unknown fields', () => {
    const unsafe = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n    label: "x --> y"\n-->\n`,
    ).document;
    expect(codes(unsafe)).toContain('E_GRAPH');
    const unknown = model.parseDocument(
      `# Root\n\n- A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\nstyle: bold\n-->\n`,
    ).document;
    expect(codes(unknown)).toContain('E_GRAPH');
  });

  test('[R-34] keeps the document bytes through parse and save', () => {
    expect(model.parseDocument(DOC).document.source).toBe(DOC);
    const crlf = DOC.replace(/\n/g, '\r\n');
    expect(model.parseDocument(crlf).document.source).toBe(crlf);
    const bom = `\uFEFF${DOC}`;
    expect(model.parseDocument(bom).document.source).toBe(bom);
  });
});

describe('R-34 edits keep graph references', () => {
  test('[R-34] keeps a marker through rename, reorder, and move', () => {
    const doc = model.parseDocument(DOC).document;
    const renamed = edit.applyCommand(doc, {
      type: 'setLabel',
      node: find(doc, 'A').id,
      text: 'A2',
    });
    expect(renamed.document.source).toContain('A2 <!-- ^a -->');
    expect(model.validateConventions(renamed.document)).toEqual([]);

    const moved = edit.applyCommand(doc, {
      type: 'move',
      node: find(doc, 'A').id,
      parent: find(doc, 'Group').id,
      index: 1,
    });
    expect(moved.document.source.indexOf('B <!-- ^b -->')).toBeLessThan(
      moved.document.source.indexOf('A <!-- ^a -->'),
    );
    expect(model.validateConventions(moved.document)).toEqual([]);
  });

  test('[R-34] delete removes affected edges, groups, and unused markers', () => {
    const doc = model.parseDocument(DOC).document;
    const deleted = edit.applyCommand(doc, { type: 'delete', node: find(doc, 'A').id });
    expect(deleted.document.source).toBe('# Root\n\n- Group\n  - B\n- Target\n');
    expect(graphBlocks(deleted.document.source)).toBe(0);
    expect(model.validateConventions(deleted.document)).toEqual([]);
  });

  test('[R-34] delete keeps a group that still has a root', () => {
    const doc = model.parseDocument(DOC).document;
    const withoutB = edit.applyCommand(doc, { type: 'delete', node: find(doc, 'B').id });
    expect(withoutB.document.graph.edges).toEqual([]);
    expect(withoutB.document.graph.groups).toEqual([{ roots: ['a'], label: 'Delivery' }]);
    expect(find(withoutB.document, 'A').identity?.id).toBe('a');
    expect(model.validateConventions(withoutB.document)).toEqual([]);
    const withoutA = edit.applyCommand(withoutB.document, {
      type: 'delete',
      node: find(withoutB.document, 'A').id,
    });
    expect(graphBlocks(withoutA.document.source)).toBe(0);
    expect(model.validateConventions(withoutA.document)).toEqual([]);
  });

  test('[R-34] delete survives a graph block inside the deleted section', () => {
    const source = `# Root\n\n## A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`;
    const doc = model.parseDocument(source).document;
    const result = edit.applyCommand(doc, { type: 'delete', node: find(doc, 'A').id });
    expect(result.document.source).toBe('# Root\n\n');
    expect(model.validateConventions(result.document)).toEqual([]);
  });

  test('[R-34] rejects a pasted marker without graph metadata', () => {
    const doc = model.parseDocument('# Root\n\n- A\n').document;
    const before = doc.source;
    expect(() =>
      edit.applyCommand(doc, {
        type: 'insertBlock',
        node: find(doc, 'A').id,
        text: '- P <!-- ^p -->',
      }),
    ).toThrow(edit.EditError);
    expect(doc.source).toBe(before);
  });

  test('[R-34] preserves existing convention issues through offset-shifting edits', () => {
    const doc = model.parseDocument(
      `# Root\n\n- DeleteMe <!-- ^d -->\n- Target <!-- ^t -->\n- Bad <!-- ^x --> <!-- ^y -->\n\n<!-- markmap: graph\nedges:\n  - from: d\n    to: t\n-->\n`,
    ).document;
    const deleted = edit.applyCommand(doc, { type: 'delete', node: find(doc, 'DeleteMe').id });
    expect(deleted.document.source).not.toContain('DeleteMe');
    expect(codes(deleted.document)).toContain('E_IDENTITY');

    const pasteTarget = model.parseDocument(
      `# Root\n\n- Target\n- Bad <!-- ^x --> <!-- ^y -->\n`,
    ).document;
    const pasted = edit.applyCommand(pasteTarget, {
      type: 'insertBlock',
      node: find(pasteTarget, 'Target').id,
      text: '- P <!-- ^p -->\n\n<!-- markmap: graph\nedges:\n  - from: p\n    to: root\n-->',
    });
    expect(pasted.document.graph.edges).toHaveLength(1);
    expect(codes(pasted.document)).toContain('E_IDENTITY');
  });

  test('[R-34] copy mints only referenced identities and merges the graph on paste', () => {
    const doc = model.parseDocument(DOC).document;
    const copied = edit.copyBlock(doc, find(doc, 'Group').id, { random });
    expect(copied).not.toBeNull();
    if (copied === null) throw new Error('No copied block');
    expect(graphBlocks(copied)).toBe(1);
    expect(copied).not.toContain('<!-- ^a -->');
    expect(copied).not.toContain('<!-- ^b -->');
    const fragment = model.parseDocument(copied).document;
    expect(fragment.graph.edges).toHaveLength(1);
    expect(fragment.graph.groups).toHaveLength(1);
    expect(model.validateConventions(fragment)).toEqual([]);

    const pasted = edit.applyCommand(doc, {
      type: 'insertBlock',
      node: find(doc, 'Target').id,
      text: copied,
    });
    expect(graphBlocks(pasted.document.source)).toBe(1);
    expect(pasted.document.graph.edges).toHaveLength(2);
    expect(pasted.document.graph.groups).toHaveLength(2);
    expect(model.validateConventions(pasted.document)).toEqual([]);
  });

  test('[R-34] copy omits an edge to a node outside the subtree', () => {
    const source = `# Root\n\n- Group\n  - A <!-- ^a -->\n- B <!-- ^b -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: b\n-->\n`;
    const doc = model.parseDocument(source).document;
    const copied = edit.copyBlock(doc, find(doc, 'Group').id, { random });
    expect(copied).toBe('- Group\n  - A');
    const pasted = edit.applyCommand(doc, {
      type: 'insertBlock',
      node: find(doc, 'B').id,
      text: copied ?? '',
    });
    expect(pasted.document.graph.edges).toEqual(doc.graph.edges);
    expect(pasted.document.graph.groups).toEqual(doc.graph.groups);
    expect(model.validateConventions(pasted.document)).toEqual([]);
  });

  test('[R-34] copy omits a partially copied group', () => {
    const source = `# Root\n\n- Group\n  - A <!-- ^a -->\n- Outside <!-- ^o -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: o\ngroups:\n  - roots: [a, o]\n-->\n`;
    const doc = model.parseDocument(source).document;
    const copied = edit.copyBlock(doc, find(doc, 'Group').id, { random });
    expect(copied).toBe('- Group\n  - A');
    expect(model.parseDocument(copied ?? '').document.graph.edges).toEqual([]);
  });

  test('[R-34] subtree copy omits every edge and group that references root', () => {
    const source = `# Root\n\n- Group\n  - A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\ngroups:\n  - roots: [a, root]\n-->\n`;
    const doc = model.parseDocument(source).document;
    const copied = edit.copyBlock(doc, find(doc, 'Group').id, { random });
    expect(copied).toBe('- Group\n  - A');
    expect(graphBlocks(copied ?? '')).toBe(0);
  });

  test('[R-34] whole root copy keeps the original graph block exactly once', () => {
    const heading = `# Root\n\n- Group\n  - A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`;
    const title = `---\ntitle: Root\n---\n\n- Group\n  - A <!-- ^a -->\n\n<!-- markmap: graph\nedges:\n  - from: a\n    to: root\n-->\n`;
    for (const source of [heading, title]) {
      const doc = model.parseDocument(source).document;
      const copied = edit.copyBlock(doc, doc.root, { random });
      expect(copied).not.toBeNull();
      if (copied === null) throw new Error('No copied block');
      expect(graphBlocks(copied)).toBe(1);
      expect(copied).toContain('from: a');
      expect(copied).toContain('to: root');
      expect(copied).toContain('<!-- ^a -->');
    }
  });

  test('[R-34] copy never duplicates the document graph block', () => {
    const doc = model.parseDocument(DOC).document;
    const copied = edit.copyBlock(doc, doc.root, { random });
    expect(copied).not.toBeNull();
    if (copied === null) throw new Error('No copied block');
    expect(graphBlocks(copied)).toBe(1);
    expect(copied).toContain('edges:');
    expect(model.validateConventions(model.parseDocument(copied).document)).toEqual([]);
  });
});

describe('R-34 identity generation', () => {
  test('[R-34] mintIdentity is deterministic with injected randomness', () => {
    const first = model.mintIdentity(new Set(['0', '1']), () => 0);
    const second = model.mintIdentity(new Set(['0', '1']), () => 0);
    expect(first).toBe('2');
    expect(second).toBe(first);
    expect(first).toMatch(/^[A-Za-z0-9]{1,3}$/);
  });

  test('[R-34] mintIdentity grows the id and refuses when the space is exhausted', () => {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const one = new Set(alphabet.split(''));
    expect(model.mintIdentity(one, () => 0)).toHaveLength(2);
    const all = new Set<string>();
    for (const first of alphabet) all.add(first);
    for (const first of alphabet) for (const second of alphabet) all.add(first + second);
    for (const first of alphabet)
      for (const second of alphabet) for (const third of alphabet) all.add(first + second + third);
    expect(model.mintIdentity(all, () => 0)).toBeNull();
  });
});
