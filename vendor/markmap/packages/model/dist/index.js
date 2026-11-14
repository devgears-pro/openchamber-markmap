import { parse } from "@markmap/parse";
// src/source.ts
function lineStart(source, offset) {
	const index = source.lastIndexOf("\n", offset - 1);
	return index === -1 ? 0 : index + 1;
}
function lineEnd(source, offset) {
	const index = source.indexOf("\n", offset);
	return index === -1 ? source.length : index;
}
function firstLine(source, offset) {
	return source.slice(offset, lineEnd(source, offset));
}
function indentWidth(indent) {
	let width = 0;
	for (const char of indent) if (char === " ") width += 1;
	else if (char === "	") width += 4;
	else break;
	return width;
}
var LIST_MARKER = /^([ \t]*)([-+*]|\d{1,9}[.)])(?:[ \t]+|$)(\[[ xX]\][ \t]+)?/;
var HEADING_MARKER = /^[ \t]{0,3}(#{1,6})(?:[ \t]+|$)/;
// src/build.ts
function parseDocument(source) {
	const { root, frontmatter } = parse(source);
	return {
		document: buildFromTree(source, root),
		tree: root,
		frontmatter
	};
}
function buildDocument(source) {
	return parseDocument(source).document;
}
function buildFromTree(source, root) {
	const nodes = /* @__PURE__ */ new Map();
	const order = [];
	const visit = (tree, parent) => {
		const node = buildNode(source, tree, parent);
		nodes.set(node.id, node);
		order.push(node.id);
		for (const child of tree.children) visit(child, node);
	};
	visit(root, null);
	const unit = detectUnit(nodes, order);
	return {
		source,
		root: root.id,
		nodes,
		order,
		unit
	};
}
function buildNode(source, tree, parent) {
	const kind = tree.id === "root" ? "root" : tree.type === "heading" ? "heading" : tree.type === "listItem" ? "listItem" : "opaque";
	const rawBlock = tree.source?.block ? clampRange(tree.source.block, source.length) : null;
	const block = rawBlock ? normalizeBlock(source, rawBlock) : null;
	const opaqueByKind = kind === "opaque" || kind !== "root" && !block;
	const depth = typeof tree.data.depth === "number" ? tree.data.depth : null;
	let list = null;
	let label = tree.source?.label ? clampRange(tree.source.label, source.length) : null;
	let level = 0;
	let opaque = opaqueByKind;
	if (kind === "listItem" && block) {
		const line = firstLine(source, block.start);
		const match = LIST_MARKER.exec(line);
		const ordered = tree.data.ordered === true;
		const checked = typeof tree.data.checked === "boolean" ? tree.data.checked : null;
		if (!match) {
			opaque = true;
			list = {
				ordered,
				marker: "-",
				indent: "",
				checked
			};
		} else {
			const rest = line.slice(match[0].length);
			if (/^#{1,6}(?:[ \t]+|$)/.test(rest)) opaque = true;
			list = {
				ordered,
				marker: match[2],
				indent: match[1],
				checked
			};
			if (!label) {
				const point = block.start + match[0].length;
				label = {
					start: point,
					end: point
				};
			}
		}
		level = parent?.kind === "listItem" ? parent.level + 1 : 1;
	} else if (kind === "heading" || kind === "root") {
		level = depth ?? 0;
		if (block) {
			const line = firstLine(source, block.start);
			const match = HEADING_MARKER.exec(line);
			if (!match) opaque = true;
			else {
				level = match[1].length;
				if (!label) {
					const point = block.start + match[0].length;
					label = {
						start: point,
						end: point
					};
				}
			}
		} else if (kind === "heading") opaque = true;
	}
	if (kind === "heading" && (level < 1 || level > 6)) opaque = true;
	const node = {
		id: tree.id,
		kind,
		parent: parent?.id ?? null,
		children: tree.children.map((child) => child.id),
		level,
		label,
		block,
		list,
		opaque,
		capabilities: emptyCapabilities()
	};
	node.capabilities = readCapabilities(node, parent);
	return node;
}
function readCapabilities(node, parent) {
	const base = {
		editLabel: false,
		addChild: false,
		addSibling: false,
		outdent: false,
		delete: false,
		move: false,
		toggleCheck: false
	};
	if (node.kind === "opaque") return {
		...base,
		delete: Boolean(parent && node.block),
		move: Boolean(parent && node.block)
	};
	if (node.kind === "root") return {
		...base,
		editLabel: Boolean(node.label && node.block),
		addChild: !node.opaque
	};
	if (node.opaque) return {
		...base,
		delete: Boolean(parent),
		move: Boolean(parent)
	};
	if (node.kind === "heading") return {
		...base,
		editLabel: Boolean(node.label && node.block),
		addChild: node.level < 6,
		addSibling: Boolean(parent),
		outdent: parent?.kind === "heading",
		delete: Boolean(parent),
		move: Boolean(parent)
	};
	return {
		...base,
		editLabel: Boolean(node.label && node.block),
		addChild: true,
		addSibling: Boolean(parent),
		outdent: parent?.kind === "listItem",
		delete: Boolean(parent),
		move: Boolean(parent),
		toggleCheck: node.list?.checked != null
	};
}
function emptyCapabilities() {
	return {
		editLabel: false,
		addChild: false,
		addSibling: false,
		outdent: false,
		delete: false,
		move: false,
		toggleCheck: false
	};
}
function clampRange(range, length) {
	const start = Math.max(0, Math.min(range.start, length));
	return {
		start,
		end: Math.max(start, Math.min(range.end, length))
	};
}
function normalizeBlock(source, range) {
	const start = lineStart(source, range.start);
	let end = range.end;
	if (end < source.length) {
		const endLine = lineStart(source, end);
		if (/^[ \t]{0,3}$/.test(source.slice(endLine, end))) end = endLine;
	}
	return {
		start,
		end
	};
}
function detectUnit(nodes, order) {
	for (const id of order) {
		const node = nodes.get(id);
		if (node?.kind !== "listItem" || !node.list || !node.parent) continue;
		const parent = nodes.get(node.parent);
		if (parent?.kind !== "listItem" || !parent.list) continue;
		if (node.list.indent.length > parent.list.indent.length) return node.list.indent.slice(parent.list.indent.length);
	}
	return "  ";
}
function nodeAtOffset(doc, offset) {
	let best;
	for (const id of doc.order) {
		const node = doc.nodes.get(id);
		if (!node?.block || node.kind === "root") continue;
		if (offset < node.block.start || offset > node.block.end) continue;
		if (node.block.end - node.block.start <= (best?.block ? best.block.end - best.block.start : Infinity)) best = node;
	}
	return best;
}
function labelText(doc, node) {
	if (!node.label) return "";
	return doc.source.slice(node.label.start, node.label.end);
}
function indentColumns(node) {
	return node.list ? indentWidth(node.list.indent) : 0;
}
// src/validate.ts
var ModelError = class extends Error {
	issues;
	constructor(issues) {
		super(issues.map((issue) => issue.message).join("; "));
		this.name = "ModelError";
		this.issues = issues;
	}
};
function validateDocument(doc) {
	const issues = [];
	const add = (code, message, nodeId) => {
		issues.push(nodeId ? {
			code,
			message,
			nodeId
		} : {
			code,
			message
		});
	};
	const root = doc.nodes.get(doc.root);
	if (!root) {
		add("E_ROOT", "Root node is missing");
		return issues;
	}
	if (root.kind !== "root") add("E_ROOT", "Root node is not a root", root.id);
	if (root.parent) add("E_ROOT", "Root node has a parent", root.id);
	const traversal = [];
	const visited = /* @__PURE__ */ new Set();
	const stack = [doc.root];
	while (stack.length) {
		const id = stack.pop();
		if (id == null) continue;
		if (visited.has(id)) {
			add("E_CYCLE", `Node ${id} is reachable twice`, id);
			continue;
		}
		visited.add(id);
		traversal.push(id);
		const node = doc.nodes.get(id);
		if (!node) {
			add("E_PARENT", `Node ${id} is missing`, id);
			continue;
		}
		for (let index = node.children.length - 1; index >= 0; index -= 1) stack.push(node.children[index]);
	}
	if (traversal.length !== doc.order.length) add("E_ORDER", "Node order does not match the tree");
	for (let index = 0; index < Math.min(traversal.length, doc.order.length); index += 1) if (traversal[index] !== doc.order[index]) {
		add("E_ORDER", `Node order differs at index ${index}`);
		break;
	}
	if (visited.size !== doc.nodes.size) add("E_ORDER", "Some nodes are not reachable from the root");
	for (const id of doc.order) {
		const node = doc.nodes.get(id);
		if (!node) {
			add("E_PARENT", `Node ${id} is missing`, id);
			continue;
		}
		validateNode(doc, node, add);
	}
	return issues;
}
function validateNode(doc, node, add) {
	const sourceLength = doc.source.length;
	if (node.kind === "listItem" && !node.list) add("E_KIND", "A list item has no list info", node.id);
	if (node.kind !== "listItem" && node.list) add("E_KIND", "A non-list node has list info", node.id);
	if (node.block) {
		if (!isRange(node.block, sourceLength)) add("E_RANGE", "Block range is outside the source", node.id);
		else validateSlice(doc, node, add);
	} else if (node.kind !== "root" && !node.opaque) add("E_RANGE", "A non-root node has no block range", node.id);
	if (node.label) {
		if (!isRange(node.label, sourceLength)) add("E_LABEL", "Label range is outside the source", node.id);
		else if (node.block && !contains(node.block, node.label)) add("E_LABEL", "Label range is outside the block", node.id);
		else if (node.kind !== "listItem" && doc.source.slice(node.label.start, node.label.end).includes("\n")) add("E_LABEL", "A heading label must stay on one line", node.id);
	}
	if (node.parent) {
		const parent = doc.nodes.get(node.parent);
		if (!parent) add("E_PARENT", "Parent node is missing", node.id);
		else {
			if (!parent.children.includes(node.id)) add("E_PARENT", "Parent does not list this child", node.id);
			if (parent.block && node.block && !contains(parent.block, node.block)) add("E_RANGE", "Child block is outside the parent block", node.id);
			if (node.kind === "heading") {
				if (parent.kind === "heading" && node.level <= parent.level) add("E_LEVEL", "Child heading must be deeper than its parent", node.id);
				else if (parent.kind === "root" && parent.level > 0 && node.level <= parent.level) add("E_LEVEL", "Child heading must be deeper than the root heading", node.id);
				else if (parent.kind !== "heading" && parent.kind !== "root") add("E_KIND", "A heading cannot be a child of a list item", node.id);
			}
			if (node.kind === "listItem") {
				if (parent.kind === "listItem" && parent.list && node.list) {
					if (indentWidth(node.list.indent) <= indentWidth(parent.list.indent)) add("E_INDENT", "Nested list item must be indented deeper than its parent", node.id);
					if (node.level !== parent.level + 1) add("E_LEVEL", "Nested list item has the wrong level", node.id);
				} else if (node.level !== 1) add("E_LEVEL", "A top-level list item must have level 1", node.id);
			}
		}
	} else if (node.id !== doc.root) add("E_PARENT", "Only the root may have no parent", node.id);
	if (node.kind === "heading" && (node.level < 1 || node.level > 6)) add("E_LEVEL", "Heading level must be between 1 and 6", node.id);
	if (node.kind === "root" && node.block && (node.level < 1 || node.level > 6)) add("E_LEVEL", "Root heading level must be between 1 and 6", node.id);
	const seen = /* @__PURE__ */ new Set();
	let previousEnd = null;
	for (const childId of node.children) {
		if (seen.has(childId)) add("E_ORDER", "Duplicate child id", node.id);
		seen.add(childId);
		const child = doc.nodes.get(childId);
		if (!child) {
			add("E_PARENT", `Child ${childId} is missing`, node.id);
			continue;
		}
		if (child.parent !== node.id) add("E_PARENT", "Child points to another parent", childId);
		if (child.block) {
			if (previousEnd != null && child.block.start < previousEnd) add("E_RANGE", "Sibling blocks overlap or are out of order", childId);
			previousEnd = child.block.end;
		}
	}
}
function validateSlice(doc, node, add) {
	if (!node.block || node.opaque) return;
	const line = firstLine(doc.source, node.block.start);
	if (node.kind === "heading" || node.kind === "root") {
		const match = HEADING_MARKER.exec(line);
		if (!match) {
			add("E_SLICE", "Heading block does not start with hashes", node.id);
			return;
		}
		if (match[1].length !== node.level) add("E_SLICE", "Heading level does not match the source", node.id);
		return;
	}
	if (node.kind === "listItem") {
		const match = LIST_MARKER.exec(line);
		if (!match) {
			add("E_SLICE", "List item block does not start with a marker", node.id);
			return;
		}
		if (!node.list || match[1] !== node.list.indent || match[2] !== node.list.marker) add("E_SLICE", "List marker does not match the source", node.id);
	}
}
function isRange(range, length) {
	return Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 && range.end <= length && range.start <= range.end;
}
function contains(outer, inner) {
	return inner.start >= outer.start && inner.end <= outer.end;
}
function assertDocument(doc) {
	const issues = validateDocument(doc);
	if (issues.length) throw new ModelError(issues);
}
export { HEADING_MARKER, LIST_MARKER, ModelError, assertDocument, buildDocument, buildFromTree, firstLine, indentColumns, indentWidth, labelText, lineEnd, lineStart, nodeAtOffset, parseDocument, validateDocument };
