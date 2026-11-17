import { HEADING_MARKER, LIST_MARKER, contentIndent, contentNodeCount, firstLine, labelText, lineEnd, lineStart, mintIdentity, newConventionIssues, nodeAtOffset, normalizeNoteText, noteText, notesText, parseDocument, serializeGraphBlock, validateDocument } from "@markmap/model";
// src/errors.ts
var EditError = class extends Error {
	code;
	nodeId;
	constructor(code, message, nodeId) {
		super(message);
		this.name = "EditError";
		this.code = code;
		if (nodeId) this.nodeId = nodeId;
	}
};
// src/splice.ts
function applySplices(source, splices) {
	const indexed = splices.map((splice, index) => ({
		...splice,
		index
	})).toSorted((a, b) => a.from - b.from || a.to - b.to);
	const starts = Array.from({ length: splices.length }, () => 0);
	let text = "";
	let last = 0;
	for (const splice of indexed) {
		if (splice.from < last || splice.to < splice.from || splice.to > source.length) throw new EditError("E_SPLICE", "Splices overlap or fall outside the source");
		text += source.slice(last, splice.from);
		starts[splice.index] = text.length;
		text += splice.insert;
		last = splice.to;
	}
	text += source.slice(last);
	return {
		text,
		starts
	};
}
function mapOffset(splices, offset) {
	let delta = 0;
	for (const splice of splices.toSorted((a, b) => a.from - b.from || a.to - b.to)) if (offset >= splice.to) delta += splice.insert.length - (splice.to - splice.from);
	else if (offset > splice.from) return splice.from + delta + splice.insert.length;
	else break;
	return offset + delta;
}
// src/graph.ts
function copyBlock(doc, nodeId, options) {
	const node = doc.nodes.get(nodeId);
	if (!node) return null;
	const ending = doc.source.includes("\r\n") ? "\r\n" : "\n";
	const slice = copySlice(doc, node, options.title ?? "");
	if (slice === null) return null;
	if (nodeId === doc.root) return copyStandalone(doc, slice, ending);
	const subtree = subtreeIds(doc, nodeId);
	const plan = copyPlan(doc, subtree, options.random);
	const text = slice.start === slice.end ? "" : doc.source.slice(slice.start, slice.end);
	const splices = [];
	const graph = doc.graph.block;
	let graphRemoved = false;
	if (graph !== null) {
		const from = Math.max(graph.start, slice.start);
		const to = Math.min(graph.end, slice.end);
		if (from < to) {
			splices.push({
				from: from - slice.start,
				to: to - slice.start,
				insert: ""
			});
			graphRemoved = true;
		}
	}
	for (const id of doc.order) {
		if (!subtree.has(id)) continue;
		const identity = doc.nodes.get(id)?.identity;
		if (!identity || identity.range === null) continue;
		const from = identity.range.start - slice.start;
		const to = identity.range.end - slice.start;
		const mapped = plan.mapping.get(identity.id);
		if (mapped !== void 0) splices.push({
			from,
			to,
			insert: `<!-- ^${mapped} -->`
		});
		else {
			let start = from;
			while (start > 0) {
				const char = text[start - 1];
				if (char !== " " && char !== "	") break;
				start -= 1;
			}
			splices.push({
				from: start,
				to,
				insert: ""
			});
		}
	}
	let body = applySplices(text, splices).text;
	if (graphRemoved) body = body.replace(/(?:\r?\n[ \t]*)+$/u, "");
	let result = slice.prefix ? body ? `${slice.prefix}${ending}${ending}${body}` : slice.prefix : body;
	const graphText = serializeGraphBlock(plan, ending);
	if (graphText) {
		const separator = result.endsWith(ending) ? ending : ending + ending;
		result = `${result}${separator}${graphText}`;
	}
	return result;
}
function copyStandalone(doc, slice, ending) {
	const text = slice.start === slice.end ? "" : doc.source.slice(slice.start, slice.end);
	let result = slice.prefix ? text ? `${slice.prefix}${ending}${ending}${text}` : slice.prefix : text;
	const graph = doc.graph.block;
	if (graph === null) return result;
	if (graph.start >= slice.start && graph.end <= slice.end) return result;
	const block = doc.source.slice(graph.start, graph.end);
	const separator = result.endsWith(ending) ? ending : ending + ending;
	result = `${result}${separator}${block}`;
	return result;
}
function copySlice(doc, node, rawTitle) {
	if (node.block) {
		let start = node.block.start;
		if (node.id === doc.root) {
			const before = node.notes.filter((note) => note.range.end <= (node.block?.start ?? 0));
			if (before.length > 0) start = Math.min(...before.map((note) => note.range.start));
		}
		return {
			start,
			end: node.block.end,
			prefix: ""
		};
	}
	if (node.id !== doc.root) return null;
	const ranges = node.notes.map((note) => note.range);
	for (const id of node.children) {
		const child = doc.nodes.get(id);
		if (child?.block) ranges.push(child.block);
	}
	const start = ranges.length ? Math.min(...ranges.map((range) => range.start)) : 0;
	const end = ranges.length ? Math.max(...ranges.map((range) => range.end)) : 0;
	const title = rawTitle.replace(/\s+/gu, " ").trim();
	if (!title && start === end) return null;
	return {
		start,
		end,
		prefix: title ? `# ${title}` : ""
	};
}
function subtreeIds(doc, nodeId) {
	const result = /* @__PURE__ */ new Set();
	const stack = [nodeId];
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === void 0) continue;
		result.add(current);
		const node = doc.nodes.get(current);
		if (node) for (const child of node.children) stack.push(child);
	}
	return result;
}
function readPastedGraph(doc, raw, ending, random) {
	const parsed = parseDocument(raw);
	const block = parsed.document.graph.block;
	if (block === null) {
		if (parsed.document.conventionIssues.some((issue) => issue.code === "E_IDENTITY")) throw new EditError("E_SHAPE", "The pasted text has an identity without graph metadata");
		return {
			body: raw,
			edges: [],
			groups: []
		};
	}
	if (parsed.document.conventionIssues.length > 0) throw new EditError("E_SHAPE", "The pasted graph metadata is invalid");
	const refs = /* @__PURE__ */ new Set();
	for (const edge of parsed.document.graph.edges) {
		refs.add(edge.from);
		refs.add(edge.to);
	}
	for (const group of parsed.document.graph.groups) for (const root of group.roots) refs.add(root);
	const taken = new Set(doc.identities.keys());
	const mapping = /* @__PURE__ */ new Map();
	for (const ref of refs) {
		if (ref === "root") continue;
		if (!taken.has(ref)) continue;
		const minted = mintIdentity(taken, random);
		if (minted === null) throw new EditError("E_SHAPE", "No node identity characters remain");
		mapping.set(ref, minted);
		taken.add(minted);
	}
	const splices = [{
		from: block.start,
		to: block.end,
		insert: ""
	}];
	for (const id of parsed.document.order) {
		const identity = parsed.document.nodes.get(id)?.identity;
		const mapped = identity ? mapping.get(identity.id) : void 0;
		if (!identity || identity.range === null || mapped === void 0) continue;
		splices.push({
			from: identity.range.start,
			to: identity.range.end,
			insert: `<!-- ^${mapped} -->`
		});
	}
	const body = applySplices(raw, splices).text;
	const ref = (value) => mapping.get(value) ?? value;
	return {
		body,
		edges: parsed.document.graph.edges.map((edge) => ({
			...edge,
			from: ref(edge.from),
			to: ref(edge.to)
		})),
		groups: parsed.document.graph.groups.map((group) => ({
			...group,
			roots: group.roots.map(ref)
		}))
	};
}
function copyPlan(doc, subtree, random) {
	const mapping = /* @__PURE__ */ new Map();
	if (doc.conventionIssues.some((issue) => issue.code === "E_GRAPH")) return {
		mapping,
		edges: [],
		groups: []
	};
	const copied = (ref) => {
		if (ref === "root") return false;
		const id = doc.identities.get(ref);
		return id !== void 0 && subtree.has(id);
	};
	const edges = doc.graph.edges.filter((edge) => copied(edge.from) && copied(edge.to));
	const groups = doc.graph.groups.filter((group) => group.roots.length > 0 && group.roots.every((root) => copied(root)));
	const required = /* @__PURE__ */ new Set();
	for (const edge of edges) {
		required.add(edge.from);
		required.add(edge.to);
	}
	for (const group of groups) for (const root of group.roots) required.add(root);
	const taken = new Set(doc.identities.keys());
	for (const id of doc.order) {
		const identity = doc.nodes.get(id)?.identity;
		if (identity && identity.range !== null) taken.add(identity.id);
	}
	for (const id of doc.order) {
		if (!subtree.has(id)) continue;
		const identity = doc.nodes.get(id)?.identity;
		if (!identity || identity.range === null) continue;
		if (!required.has(identity.id) || mapping.has(identity.id)) continue;
		const minted = mintIdentity(taken, random);
		if (minted === null) throw new EditError("E_SHAPE", "No node identity characters remain");
		mapping.set(identity.id, minted);
		taken.add(minted);
	}
	const mapEdge = (edge) => {
		const from = mapping.get(edge.from);
		const to = mapping.get(edge.to);
		return from === void 0 || to === void 0 ? null : {
			...edge,
			from,
			to
		};
	};
	const mapGroup = (group) => {
		const roots = group.roots.map((root) => mapping.get(root));
		if (roots.some((root) => root === void 0)) return null;
		return {
			...group,
			roots: roots.filter((root) => root !== void 0)
		};
	};
	return {
		mapping,
		edges: edges.flatMap((edge) => {
			const mapped = mapEdge(edge);
			return mapped === null ? [] : [mapped];
		}),
		groups: groups.flatMap((group) => {
			const mapped = mapGroup(group);
			return mapped === null ? [] : [mapped];
		})
	};
}
function removeGraphNodes(doc, removed) {
	if (doc.conventionIssues.some((issue) => issue.code === "E_GRAPH")) return {
		graph: doc.graph,
		drop: [],
		changed: false
	};
	const removedIds = /* @__PURE__ */ new Set();
	for (const id of removed) {
		const identity = doc.nodes.get(id)?.identity;
		if (identity && identity.range !== null) removedIds.add(identity.id);
	}
	const edges = doc.graph.edges.filter((edge) => !removedIds.has(edge.from) && !removedIds.has(edge.to));
	const groups = doc.graph.groups.flatMap((group) => {
		const roots = group.roots.filter((root) => !removedIds.has(root));
		return roots.length === 0 ? [] : [{
			...group,
			roots
		}];
	});
	const referenced = /* @__PURE__ */ new Set();
	for (const edge of edges) {
		referenced.add(edge.from);
		referenced.add(edge.to);
	}
	for (const group of groups) for (const root of group.roots) referenced.add(root);
	const drop = [];
	for (const id of doc.order) {
		if (removed.has(id)) continue;
		const identity = doc.nodes.get(id)?.identity;
		if (!identity || identity.range === null) continue;
		if (!referenced.has(identity.id)) drop.push({
			nodeId: id,
			range: identity.range
		});
	}
	const changed = JSON.stringify(edges) !== JSON.stringify(doc.graph.edges) || JSON.stringify(groups) !== JSON.stringify(doc.graph.groups);
	return {
		graph: {
			edges,
			groups,
			block: doc.graph.block
		},
		drop,
		changed
	};
}
function graphBlockSplices(source, doc, removal, cut) {
	if (!removal.changed) return [];
	const block = doc.graph.block;
	const empty = removal.graph.edges.length === 0 && removal.graph.groups.length === 0;
	const ending = source.includes("\r\n") ? "\r\n" : "\n";
	if (block === null) {
		const append = appendGraphSplice(source, removal.graph, ending);
		return append === null ? [] : [append];
	}
	if (block.start < cut.end && block.end > cut.start) {
		const append = appendGraphSplice(source, removal.graph, ending);
		return append === null ? [] : [append];
	}
	if (empty) return [removeGraphSplice(source, block)];
	if (!source.slice(block.start, block.end).endsWith("\n")) return [{
		from: block.start,
		to: block.end,
		insert: serializeGraphBlock(removal.graph, ending)
	}];
	const trailing = source.slice(block.start, block.end).endsWith("\r\n") ? "\r\n" : "\n";
	return [{
		from: block.start,
		to: block.end,
		insert: `${serializeGraphBlock(removal.graph, ending)}${trailing}`
	}];
}
function markerRemovalSplices(source, removal) {
	return removal.drop.flatMap((entry) => {
		let from = entry.range.start;
		while (from > 0) {
			const char = source[from - 1];
			if (char !== " " && char !== "	") break;
			from -= 1;
		}
		return [{
			from,
			to: entry.range.end,
			insert: ""
		}];
	});
}
function mergeGraphSplice(source, doc, edges, groups, ending) {
	const merged = {
		edges: [...doc.graph.edges, ...edges],
		groups: [...doc.graph.groups, ...groups],
		block: doc.graph.block
	};
	if (doc.conventionIssues.some((issue) => issue.code === "E_GRAPH")) throw new EditError("E_SHAPE", "The document graph metadata is invalid");
	if (doc.graph.block === null) {
		const append = appendGraphSplice(source, merged, ending);
		if (append === null) throw new EditError("E_SHAPE", "The graph metadata is empty");
		return append;
	}
	const original = source.slice(doc.graph.block.start, doc.graph.block.end);
	const trailing = original.endsWith("\r\n") ? "\r\n" : original.endsWith("\n") ? "\n" : "";
	return {
		from: doc.graph.block.start,
		to: doc.graph.block.end,
		insert: `${serializeGraphBlock(merged, ending)}${trailing}`
	};
}
function appendGraphSplice(source, graph, ending) {
	const block = serializeGraphBlock(graph, ending);
	if (!block) return null;
	const insert = `${source.length === 0 ? "" : source.endsWith(ending) ? ending : ending + ending}${block}${ending}`;
	return {
		from: source.length,
		to: source.length,
		insert
	};
}
function removeGraphSplice(source, block) {
	let start = block.start;
	let end = block.end;
	if (source.startsWith("\r\n", end)) end += 2;
	else if (source[end] === "\n") end += 1;
	if (start > 0) {
		const previous = source.lastIndexOf("\n", start - 2);
		const previousStart = previous === -1 ? 0 : previous + 1;
		if (source.slice(previousStart, start).trim() === "") start = previousStart;
	}
	return {
		from: start,
		to: end,
		insert: ""
	};
}
// src/format.ts
function lineEnding(source) {
	return source.includes("\r\n") ? "\r\n" : "\n";
}
function newlineLengthAt(source, offset) {
	if (source.startsWith("\r\n", offset)) return 2;
	if (source[offset] === "\n") return 1;
	return 0;
}
function cutRange(source, block) {
	let start = block.start;
	let end = block.end;
	const newline = newlineLengthAt(source, end);
	if (newline) end += newline;
	else if (end === source.length && source[end - 1] !== "\n") {
		if (source[start - 1] === "\n") start -= 1;
		if (source[start - 1] === "\r") start -= 1;
	}
	return {
		start,
		end
	};
}
function blockInsertion(source, position, block, ending) {
	const atLineStart = position === 0 || source[position - 1] === "\n" || position === 1 && source.startsWith("﻿");
	const prefix = atLineStart ? "" : ending;
	const hasNewline = block.endsWith("\n") || block.endsWith("\r\n");
	const newlineAfter = newlineLengthAt(source, position) > 0;
	let suffix = "";
	if (!hasNewline) {
		if (atLineStart) {
			if (position < source.length || newlineLengthAt(source, position - 1) > 0) suffix = ending;
		} else if (!newlineAfter && position < source.length) suffix = ending;
	}
	return {
		insert: prefix + block + suffix,
		leading: prefix.length
	};
}
function insertLine(source, position, line, ending) {
	if (position === 0 || source[position - 1] === "\n" || position === 1 && source.startsWith("﻿")) return {
		insert: line + (position < source.length || source.endsWith("\n") ? ending : ""),
		leading: 0
	};
	const prefix = ending;
	const suffix = position === source.length && source.endsWith("\n") ? ending : "";
	return {
		insert: prefix + line + suffix,
		leading: prefix.length
	};
}
function placeBlock(block, ending, atLineStart, following) {
	const prefix = atLineStart ? "" : ending;
	let text = block;
	if (!(text.endsWith("\n") || text.endsWith("\r\n")) && (following || prefix)) text += ending;
	return {
		insert: prefix + text,
		leading: prefix.length
	};
}
function headingLine(level, text) {
	return `${"#".repeat(level)} ${text}`;
}
function listLine(indent, marker, text, ending) {
	if (!text.includes("\n")) return `${indent}${marker} ${text}`;
	const continuation = indent + " ".repeat(marker.length + 1);
	return text.split("\n").map((line, index) => {
		if (index === 0) return line;
		return line ? continuation + line : "";
	}).join(ending).replace(/^/, `${indent}${marker} `);
}
function cleanLabel(text) {
	return text.replace(/\r\n?/g, "\n").trim();
}
function listContinuation(node) {
	if (!node.list) return "";
	return node.list.indent + " ".repeat(node.list.marker.length + 1);
}
function formatListText(node, text, ending) {
	const continuation = listContinuation(node);
	return text.split("\n").map((line, index) => index === 0 ? line : line ? continuation + line : "").join(ending);
}
function assertSingleLine(node, text) {
	if (text.includes("\n")) throw new EditError("E_LABEL", "A heading label cannot contain a line break", node.id);
}
function childIndent(doc, node) {
	const first = node.children.map((id) => doc.nodes.get(id)).filter((child) => child?.kind === "listItem").find((child) => child.list);
	if (first?.list) return first.list.indent;
	return (node.list?.indent ?? "") + doc.unit;
}
function childMarker(doc, node) {
	for (const id of node.children) {
		const child = doc.nodes.get(id);
		if (child?.kind === "listItem" && child.list) return child.list.marker;
	}
	return "-";
}
function dedentList(text, fromIndent, toIndent, ending) {
	const delta = fromIndent.length - toIndent.length;
	if (delta <= 0) return text;
	return text.split(ending).map((line, index) => {
		if (index === 0) return line.startsWith(fromIndent) ? toIndent + line.slice(fromIndent.length) : line;
		if (!line.trim()) return line;
		const match = /^[ \t]*/.exec(line);
		const prefix = match ? match[0] : "";
		if (prefix.length >= delta) return prefix.slice(delta) + line.slice(prefix.length);
		return line;
	}).join(ending);
}
function dedentHeadings(doc, node, delta, ending) {
	if (!node.block) throw new EditError("E_SHAPE", "The node has no block", node.id);
	const levels = /* @__PURE__ */ new Map();
	const collect = (parent) => {
		for (const id of parent.children) {
			const child = doc.nodes.get(id);
			if (!child?.block) continue;
			if (child.kind === "heading") {
				const level = child.level - delta;
				if (level < 1) throw new EditError("E_LEVEL", "Heading level would drop below one", child.id);
				levels.set(child.block.start - node.block.start, level);
			}
			collect(child);
		}
	};
	const own = node.level - delta;
	if (own < 1) throw new EditError("E_LEVEL", "Heading level would drop below one", node.id);
	levels.set(0, own);
	collect(node);
	const block = doc.source.slice(node.block.start, node.block.end);
	let offset = 0;
	return block.split(ending).map((line) => {
		const level = levels.get(offset);
		offset += line.length + ending.length;
		if (level == null) return line;
		return line.replace(/^([ \t]{0,3})(#{1,6})(?=[ \t]|$)/, (_, space) => {
			return `${space}${"#".repeat(level)}`;
		});
	}).join(ending);
}
function firstLineMarker(text) {
	const line = firstLine(text, 0);
	const list = LIST_MARKER.exec(line);
	if (list) return list[0].length;
	const heading = HEADING_MARKER.exec(line);
	return heading ? heading[0].length : 0;
}
function shiftHeadings(text, delta, ending) {
	if (delta === 0) return text;
	const { document } = parseDocument(text);
	const levels = /* @__PURE__ */ new Map();
	for (const id of document.order) {
		const node = document.nodes.get(id);
		if (!node?.block || node.kind !== "heading" && node.kind !== "root") continue;
		const level = node.level + delta;
		if (level < 1) throw new EditError("E_LEVEL", "Heading level would drop below one", node.id);
		if (level > 6) throw new EditError("E_LEVEL", "Heading level cannot exceed six", node.id);
		levels.set(node.block.start, level);
	}
	let offset = 0;
	return text.split(ending).map((line) => {
		const level = levels.get(offset);
		offset += line.length + ending.length;
		if (level == null) return line;
		return line.replace(/^([ \t]{0,3})(#{1,6})(?=[ \t]|$)/, (_, space) => {
			return `${space}${"#".repeat(level)}`;
		});
	}).join(ending);
}
function listStartLine(line, node, base) {
	if (node.kind === "heading" || node.kind === "root") {
		const match = /^[ \t]{0,3}(#{1,6})(?:[ \t]+|$)/.exec(line);
		if (!match) return line;
		return `${base}- ${line.slice(match[0].length)}`;
	}
	if (node.kind === "listItem") {
		const match = /^[ \t]*([-+*]|\d{1,9}[.)])(?:[ \t]+|$)(\[[ xX]\][ \t]+)?/.exec(line);
		if (!match) return line;
		return `${base}${match[1]} ${match[2] ?? ""}${line.slice(match[0].length)}`;
	}
	return line;
}
function listContinuationLine(line, node, base) {
	const list = node.list;
	const originalBase = list ? list.indent.length : 0;
	const originalWidth = list ? list.marker.length + 1 : 0;
	const width = list ? list.marker.length + 1 : 2;
	const prefix = /^[ \t]*/.exec(line)?.[0] ?? "";
	const relative = Math.max(0, prefix.length - originalBase - originalWidth);
	return `${base}${" ".repeat(width + relative)}${line.slice(prefix.length)}`;
}
function headingsToList(text, indent, unit, ending) {
	const { document } = parseDocument(text);
	const root = document.nodes.get(document.root);
	if (!root) throw new EditError("E_SHAPE", "The pasted text has no root");
	const top = root.block ? root : root.children.map((id) => document.nodes.get(id)).find((child) => Boolean(child?.block));
	if (!top) throw new EditError("E_SHAPE", "The pasted text has no editable node");
	const depths = /* @__PURE__ */ new Map();
	const visit = (node, depth) => {
		depths.set(node.id, depth);
		for (const id of node.children) {
			const child = document.nodes.get(id);
			if (child) visit(child, depth + 1);
		}
	};
	visit(top, 0);
	let offset = 0;
	return text.split(ending).map((line) => {
		const start = offset;
		offset += line.length + ending.length;
		if (!line.trim()) return line;
		const owner = nodeAtOffset(document, start);
		const depth = owner ? depths.get(owner.id) : void 0;
		if (!owner || depth === void 0) return line;
		const base = indent + unit.repeat(depth);
		if (owner.block?.start === start) return listStartLine(line, owner, base);
		return listContinuationLine(line, owner, base);
	}).join(ending);
}
function listToHeadings(text, level, ending) {
	const { document } = parseDocument(text);
	const root = document.nodes.get(document.root);
	if (!root) throw new EditError("E_SHAPE", "The moved text has no root");
	const tops = (root.block ? [root] : root.children.map((id) => document.nodes.get(id))).filter((node) => node !== void 0 && Boolean(node.block));
	if (!tops.length || tops.some((node) => node.kind !== "listItem")) throw new EditError("E_SHAPE", "The moved text is not a list");
	const depths = /* @__PURE__ */ new Map();
	const visit = (node, depth) => {
		depths.set(node.id, depth);
		for (const id of node.children) {
			const child = document.nodes.get(id);
			if (child) visit(child, depth + 1);
		}
	};
	for (const top of tops) visit(top, 0);
	let offset = 0;
	return text.split(ending).map((line) => {
		const start = offset;
		offset += line.length + ending.length;
		if (!line.trim()) return line;
		const owner = nodeAtOffset(document, start);
		const depth = owner ? depths.get(owner.id) : void 0;
		if (!owner || depth === void 0) return line;
		const target = level + depth;
		if (target < 1 || target > 6) throw new EditError("E_LEVEL", "Heading level cannot exceed six", owner.id);
		if (owner.block?.start === start) {
			const match = /^([ \t]*)([-+*]|\d{1,9}[.)])(?:[ \t]+|$)(\[[ xX]\][ \t]+)?/.exec(line);
			if (!match) return line;
			return `${"#".repeat(target)} ${line.slice(match[0].length)}`;
		}
		const list = owner.list;
		if (!list) return line;
		const prefix = /^[ \t]*/.exec(line)?.[0] ?? "";
		const base = list.indent.length + list.marker.length + 1;
		const relative = Math.max(0, prefix.length - base);
		return `${" ".repeat(relative)}${line.slice(prefix.length)}`;
	}).join(ending);
}
function reindentList(text, delta, ending) {
	if (delta === 0) return text;
	if (delta > 0) {
		const pad = " ".repeat(delta);
		return text.split(ending).map((line) => line.trim() ? pad + line : line).join(ending);
	}
	const cut = -delta;
	return text.split(ending).map((line) => {
		if (!line.trim()) return line;
		const prefix = /^[ \t]*/.exec(line)?.[0] ?? "";
		if (prefix.length >= cut) return prefix.slice(cut) + line.slice(prefix.length);
		return line;
	}).join(ending);
}
// src/commands.ts
function applyCommand(doc, command) {
	const plan = planCommand(doc, command);
	const { text, starts } = applySplices(doc.source, plan.edits);
	const { document: next, tree } = parseDocument(text);
	const issues = validateDocument(next);
	if (issues.length) throw new EditError("E_SHAPE", `The edit produced an invalid document: ${issues[0].message}`, issues[0].nodeId);
	const selection = plan.selection.kind === "insert" ? starts[plan.selection.edit] + plan.selection.offset : mapOffset(plan.edits, plan.selection.offset);
	plan.verify(next, selection);
	return {
		document: next,
		tree,
		edits: plan.edits,
		selection
	};
}
function planCommand(doc, command) {
	if (command.type === "deleteNodes") return planDeleteNodes(doc, command.nodes);
	if (command.type === "moveNodes") return planMoveNodes(doc, command.nodes, command.parent, command.index);
	const node = nodeOf(doc, command.node);
	switch (command.type) {
		case "setLabel": return planSetLabel(doc, node, command.text);
		case "setNotes": return planSetNotes(doc, node, command.text);
		case "createRootHeading": return planCreateRootHeading(doc, node, command.text);
		case "insertChild": return planInsert(doc, node, command.text ?? "", "child");
		case "insertSibling": return planInsert(doc, node, command.text ?? "", "sibling");
		case "insertBlock": return planInsertBlock(doc, node, command.text, command.random);
		case "delete": return planDelete(doc, node);
		case "outdent": return planOutdent(doc, node);
		case "move": return planMove(doc, node, command.parent, command.index);
		case "toggleCheck": return planToggleCheck(doc, node);
	}
}
function planSetLabel(doc, node, raw) {
	requireCapability(node, "editLabel");
	if (!node.label) throw new EditError("E_LABEL", "The node has no editable label", node.id);
	const text = cleanLabel(raw);
	let insert;
	let expected;
	if (node.kind === "heading" || node.kind === "root") {
		assertSingleLine(node, text);
		insert = headingLabelInsertion(doc, node, text);
		expected = text;
	} else {
		insert = formatListText(node, text, lineEnding(doc.source));
		expected = insert;
	}
	const blockStart = node.block?.start;
	return {
		edits: [{
			from: node.label.start,
			to: node.label.end,
			insert
		}],
		selection: {
			kind: "insert",
			edit: 0,
			offset: insert.length
		},
		verify(next) {
			if (contentNodeCount(next) !== contentNodeCount(doc)) throw shape("The node count changed");
			const found = blockStart == null ? void 0 : nodeByBlockStart(next, blockStart);
			if (!found || found.kind !== node.kind || found.parent !== node.parent) throw shape("The edited node changed shape");
			if (!found.label || next.source.slice(found.label.start, found.label.end) !== expected) throw shape("The label did not survive parsing");
		}
	};
}
function headingLabelInsertion(doc, node, text) {
	if (!node.label || node.label.start !== node.label.end) return text;
	const before = doc.source[node.label.start - 1];
	const after = doc.source[node.label.start];
	return before === "#" && after !== " " && after !== "	" ? ` ${text}` : text;
}
function planSetNotes(doc, node, raw) {
	if (!node.capabilities.editNotes) throw new EditError("E_CAPABILITY", "The node cannot hold notes", node.id);
	const text = normalizeNoteText(raw);
	const offset = noteAnchor(node);
	const notes = [...node.notes].toSorted((a, b) => a.range.start - b.range.start);
	let edits;
	if (!text) edits = noteCuts(doc.source, notes).map((cut) => ({
		from: cut.start,
		to: cut.end,
		insert: ""
	}));
	else if (notes.length === 1 && notes[0]?.fence && notesText(doc, node) === text) edits = [];
	else {
		const ending = lineEnding(doc.source);
		const position = notesInsertion(doc, node);
		const fence = fenceText(text, contentIndent(node), ending);
		const atLineStart = position === 0 || doc.source[position - 1] === "\n";
		let insert = atLineStart ? fence : ending + fence;
		if (atLineStart || position < doc.source.length) insert += ending;
		edits = [{
			from: position,
			to: position,
			insert
		}];
		for (const cut of noteCuts(doc.source, notes)) edits.push({
			from: cut.start,
			to: cut.end,
			insert: ""
		});
	}
	const verify = (next) => verifyNotes(doc, node, next, text, edits);
	return {
		edits,
		selection: {
			kind: "source",
			offset
		},
		verify
	};
}
function noteAnchor(node) {
	return node.label?.start ?? node.block?.start ?? 0;
}
function notesInsertion(doc, node) {
	if (node.kind === "root" && !node.block) {
		const first = node.children.length ? doc.nodes.get(node.children[0]) : void 0;
		return first?.block ? lineStart(doc.source, first.block.start) : doc.source.length;
	}
	const anchor = node.label?.end ?? node.block?.start ?? 0;
	const end = lineEnd(doc.source, anchor);
	if (end >= doc.source.length) return doc.source.length;
	return end + newlineLengthAt(doc.source, end);
}
function noteCuts(source, notes) {
	const cuts = notes.map((note) => noteCut(source, note.range)).toSorted((a, b) => a.start - b.start);
	const merged = [];
	for (const cut of cuts) {
		const last = merged.at(-1);
		if (last && cut.start <= last.end) last.end = Math.max(last.end, cut.end);
		else merged.push({ ...cut });
	}
	return merged;
}
function noteCut(source, range) {
	let start = lineStart(source, range.start);
	let end = lineEnd(source, range.end);
	const newline = newlineLengthAt(source, end);
	if (newline) end += newline;
	if (end < source.length) {
		const after = lineEnd(source, end);
		if (!source.slice(end, after).trim()) end = after + newlineLengthAt(source, after);
	} else if (start > 0) {
		const before = lineStart(source, start - 1);
		if (!source.slice(before, start).trim()) start = before;
	}
	return {
		start,
		end
	};
}
function fenceText(text, indent, ending) {
	const fence = "`".repeat(fenceLength(text));
	const lines = text.split("\n").map((line) => line ? indent + line : "");
	return [
		indent + fence + "markmap-note",
		...lines,
		indent + fence
	].join(ending);
}
function fenceLength(text) {
	let longest = 0;
	for (const run of text.match(/`+/gu) ?? []) longest = Math.max(longest, run.length);
	return Math.max(3, longest + 1);
}
function verifyNotes(doc, node, next, text, edits) {
	const found = node.block ? nodeByBlockStart(next, mapOffset(edits, node.block.start)) : next.nodes.get(next.root);
	const sameChildren = found !== void 0 && found.children.length === node.children.length && found.children.every((id, index) => id === node.children[index]);
	const notes = found ? found.notes : [];
	const sameNotes = text ? notes.length === 1 && notes[0]?.fence === true : notes.length === 0;
	const sameText = !text || found !== void 0 && notesText(next, found) === text;
	if (!found || contentNodeCount(next) !== contentNodeCount(doc) || !sameChildren || !sameNotes || !sameText) throw shape("The note change did not survive parsing");
}
function rootHeadingRefusal(doc, nodeId) {
	const policy = doc.rootPolicy;
	if (policy.kind === "source-heading") return new EditError("E_ROOT_EXISTS", "The document already has a root heading", nodeId);
	if (policy.kind === "title" && !policy.canCreateHeading) return new EditError("E_ROOT_TITLE", "Merge the body under one H1 to give the map a body root", nodeId);
	if (!policy.canCreateHeading) return new EditError("E_ROOT_H1", "Add a frontmatter title or group the document under one H1", nodeId);
	return null;
}
function bodyContentStart(doc) {
	const source = doc.source;
	let offset = doc.rootPolicy.bodyStart;
	while (offset < source.length) {
		const end = lineEnd(source, offset);
		if (source.slice(offset, end).trim()) return offset;
		offset = end + newlineLengthAt(source, end);
	}
	return source.length;
}
function planCreateRootHeading(doc, node, raw) {
	if (node.kind !== "root") throw new EditError("E_CAPABILITY", "Only the root can create a root heading", node.id);
	const refusal = rootHeadingRefusal(doc, node.id);
	if (refusal) throw refusal;
	const text = cleanLabel(raw);
	if (!text) throw new EditError("E_LABEL", "The label cannot be empty", node.id);
	assertSingleLine(node, text);
	const line = headingLine(1, text);
	const ending = lineEnding(doc.source);
	const position = bodyContentStart(doc);
	let edits;
	let selectionOffset;
	if (position === doc.source.length) {
		const inserted = insertLine(doc.source, position, line, ending);
		edits = [{
			from: position,
			to: position,
			insert: inserted.insert
		}];
		selectionOffset = inserted.leading + 2;
	} else {
		edits = [{
			from: position,
			to: position,
			insert: line + ending + ending
		}];
		selectionOffset = 2;
	}
	const verify = (next, selection) => {
		if (contentNodeCount(next) !== contentNodeCount(doc) + 1) throw shape("The root heading changed the content node count");
		const created = nodeByLabelStart(next, selection);
		if (!created || created.id !== next.root || created.kind !== "root" || created.level !== 1 || !created.block || !created.label || next.source.slice(created.label.start, created.label.end) !== text) throw shape("The first node is not an editable root heading");
		const expected = [created.id];
		for (const id of doc.order) {
			if (id === doc.root) continue;
			const old = doc.nodes.get(id);
			if (!old?.block) throw shape("The original node has no block");
			const found = nodeByBlockStart(next, mapOffset(edits, old.block.start));
			if (!found) throw shape("The original node did not survive the root heading");
			expected.push(found.id);
			if (old.parent === doc.root) {
				if (found.parent !== created.id) throw shape("The original node is not a child of the new root");
			} else {
				const oldParent = old.parent ? doc.nodes.get(old.parent) : void 0;
				const newParent = found.parent ? next.nodes.get(found.parent) : void 0;
				if (!oldParent?.block || !newParent?.block || newParent.block.start !== mapOffset(edits, oldParent.block.start)) throw shape("The original parent edge changed");
			}
		}
		if (expected.join("\0") !== next.order.join("\0")) throw shape("The original node order changed");
	};
	return {
		edits,
		selection: {
			kind: "insert",
			edit: 0,
			offset: selectionOffset
		},
		verify
	};
}
function headingContentInsertion(doc, node) {
	for (const id of node.children) {
		const child = doc.nodes.get(id);
		if (child?.kind === "heading" && child.block) return child.block.start;
	}
	return node.block?.end ?? doc.source.length;
}
function headingListLine(doc, node, text, ending) {
	const indent = childListIndent(doc, node);
	const marker = childMarker(doc, node);
	return {
		line: listLine(indent, marker, text, ending),
		markerLength: indent.length + marker.length + 1
	};
}
function planInsert(doc, node, raw, mode) {
	requireCapability(node, mode === "child" ? "addChild" : "addSibling");
	const ending = lineEnding(doc.source);
	const text = cleanLabel(raw);
	let position;
	let line;
	let markerLength;
	let parentId;
	let expectedKind = "listItem";
	let expectedLevel = 0;
	if (node.kind === "root") {
		parentId = node.id;
		if (node.block) {
			if (node.level === 1) {
				position = node.block.end;
				expectedKind = "heading";
				expectedLevel = 2;
				assertSingleLine(node, text);
				line = headingLine(expectedLevel, text);
				markerLength = expectedLevel + 1;
			} else {
				position = headingContentInsertion(doc, node);
				const list = headingListLine(doc, node, text, ending);
				line = list.line;
				markerLength = list.markerLength;
			}
		} else {
			const last = node.children.length ? doc.nodes.get(node.children[node.children.length - 1]) : void 0;
			if (last?.kind === "heading" && (last.level === 1 || last.level === 2)) {
				position = doc.source.length;
				expectedKind = "heading";
				expectedLevel = last.level;
				assertSingleLine(node, text);
				line = headingLine(expectedLevel, text);
				markerLength = expectedLevel + 1;
			} else if (last?.kind === "heading") {
				position = headingContentInsertion(doc, node);
				const list = headingListLine(doc, node, text, ending);
				line = list.line;
				markerLength = list.markerLength;
			} else {
				position = doc.source.length;
				const indent = last?.kind === "listItem" ? last.list?.indent ?? "" : "";
				const marker = last?.kind === "listItem" ? last.list?.marker ?? "-" : "-";
				line = listLine(indent, marker, text, ending);
				markerLength = indent.length + marker.length + 1;
			}
		}
	} else if (node.kind === "heading") {
		if (!node.block) throw shape("The heading has no block");
		const level = mode === "sibling" ? node.level : node.level + 1;
		if (level <= 2) {
			position = node.block.end;
			expectedKind = "heading";
			expectedLevel = level;
			assertSingleLine(node, text);
			line = headingLine(level, text);
			markerLength = level + 1;
			parentId = mode === "sibling" ? node.parent ?? node.id : node.id;
		} else {
			const parent = mode === "sibling" ? node.parent ? doc.nodes.get(node.parent) : void 0 : node;
			if (!parent || parent.kind !== "heading" && parent.kind !== "root") throw shape("The list fallback has no heading parent");
			position = headingContentInsertion(doc, parent);
			const list = headingListLine(doc, parent, text, ending);
			line = list.line;
			markerLength = list.markerLength;
			parentId = parent.id;
		}
	} else {
		if (!node.block || !node.list) throw shape("The list item has no block");
		position = node.block.end;
		const indent = mode === "sibling" ? node.list.indent : childIndent(doc, node);
		const marker = mode === "sibling" ? node.list.marker : childMarker(doc, node);
		line = listLine(indent, marker, text, ending);
		markerLength = indent.length + marker.length + 1;
		parentId = mode === "sibling" ? node.parent ?? node.id : node.id;
	}
	const inserted = insertLine(doc.source, position, line, ending);
	const expectedLabel = line.slice(markerLength);
	return {
		edits: [{
			from: position,
			to: position,
			insert: inserted.insert
		}],
		selection: {
			kind: "insert",
			edit: 0,
			offset: inserted.leading + markerLength
		},
		verify(next, selection) {
			if (contentNodeCount(next) !== contentNodeCount(doc) + 1) throw shape("The node count did not grow");
			const created = nodeByLabelStart(next, selection);
			if (!created || created.kind !== expectedKind || created.parent !== parentId) throw shape("The new node landed in the wrong place");
			if (expectedKind === "heading" && created.level !== expectedLevel) throw shape("The new heading has the wrong level");
			if (!created.label || next.source.slice(created.label.start, created.label.end) !== expectedLabel) throw shape("The new label did not survive parsing");
		}
	};
}
function normalizeBlockText(raw, ending) {
	const trimmed = raw.replace(/\r\n?/g, "\n").replace(/^(?:[ \t]*\n)+/u, "").replace(/(?:\n[ \t]*)+$/u, "");
	return ending === "\n" ? trimmed : trimmed.replace(/\n/g, ending);
}
function contentRootNode(doc) {
	const root = doc.nodes.get(doc.root);
	if (!root) return void 0;
	if (root.block) return root;
	return root.children.map((id) => doc.nodes.get(id)).find((child) => Boolean(child?.block));
}
function removeRanges(text, ranges) {
	let result = "";
	let last = 0;
	for (const range of ranges.toSorted((a, b) => a.start - b.start)) {
		result += text.slice(last, range.start);
		last = range.end;
	}
	return result + text.slice(last);
}
function attachLeadingNotes(moved, notes, indent, ending) {
	if (!notes.length) return moved;
	const firstBreak = moved.indexOf(ending);
	const head = firstBreak === -1 ? moved : moved.slice(0, firstBreak);
	let rest = firstBreak === -1 ? "" : moved.slice(firstBreak + ending.length);
	while (rest.startsWith(ending)) rest = rest.slice(ending.length);
	const joined = notes.join(ending + ending);
	return `${head}${ending}${ending}${indent === null ? joined : reindentList(joined, indent.length, ending)}${rest ? ending + ending + rest : ""}`;
}
function planInsertBlock(doc, node, raw, random) {
	requireCapability(node, "addChild");
	const ending = lineEnding(doc.source);
	const graphRead = readPastedGraph(doc, normalizeBlockText(raw, ending), ending, random ?? Math.random);
	const block = normalizeBlockText(graphRead.body, ending);
	if (!block.trim()) throw new EditError("E_LABEL", "The pasted text is empty", node.id);
	const fragment = parseDocument(block).document;
	const fragmentRoot = fragment.nodes.get(fragment.root);
	if (!fragmentRoot) throw shape("The pasted text has no root");
	const top = fragmentRoot.block ? fragmentRoot : fragmentRoot.children.map((id) => fragment.nodes.get(id)).find((child) => Boolean(child?.block));
	if (!top || !top.label || top.kind !== "heading" && top.kind !== "root" && top.kind !== "listItem") throw new EditError("E_SHAPE", "The pasted text has no editable node", node.id);
	const count = contentNodeCount(fragment);
	const blockStart = top.block?.start ?? 0;
	const prefixNotes = top.notes.filter((note) => note.range.end <= blockStart).toSorted((a, b) => a.range.start - b.range.start);
	if (top.kind === "heading" || top.kind === "root") {
		if (removeRanges(block.slice(0, blockStart), prefixNotes.map((note) => note.range)).trim()) throw new EditError("E_SHAPE", "The pasted prefix has content that cannot become a note", node.id);
	}
	const leading = prefixNotes.map((note) => block.slice(note.range.start, note.range.end));
	const body = top.kind === "heading" || top.kind === "root" ? block.slice(blockStart) : block;
	const prefixTexts = prefixNotes.map((note) => normalizeNoteText(noteText(fragment, top, note)));
	const prefixFences = prefixNotes.map((note) => note.fence);
	let converted;
	let moved;
	if (top.kind === "heading" || top.kind === "root") {
		if (node.kind === "listItem") {
			const indent = childIndent(doc, node);
			converted = headingsToList(body, indent, doc.unit, ending);
			moved = attachLeadingNotes(converted, leading, indent + "  ", ending);
		} else {
			converted = shiftHeadings(body, (node.kind === "root" ? node.block ? node.level : 0 : node.level) + 1 - top.level, ending);
			moved = attachLeadingNotes(converted, leading, null, ending);
		}
	} else {
		if (!top.list) throw shape("The pasted list item has no list info");
		converted = reindentList(body, (node.kind === "listItem" ? childIndent(doc, node) : "").length - top.list.indent.length, ending);
		moved = converted;
	}
	const convertedDoc = parseDocument(converted).document;
	const convertedRoot = contentRootNode(convertedDoc);
	const bodyNotes = convertedRoot?.notes ?? [];
	const bodyTexts = convertedRoot ? bodyNotes.map((note) => normalizeNoteText(noteText(convertedDoc, convertedRoot, note))) : [];
	const bodyFences = bodyNotes.map((note) => note.fence);
	const movedDoc = parseDocument(moved).document;
	const movedNotes = contentRootNode(movedDoc)?.notes ?? [];
	const expectedTexts = [...prefixTexts, ...bodyTexts];
	const expectedFences = [...prefixFences, ...bodyFences];
	if (movedNotes.length !== expectedTexts.length) throw shape("The moved root notes changed");
	const position = node.block ? node.block.end : doc.source.length;
	const placed = blockInsertion(doc.source, position, moved, ending);
	const marker = firstLineMarker(moved);
	const expected = firstLine(fragment.source, top.label.start).replace(/\r$/u, "");
	const emptyRoot = node.kind === "root" && !node.block && node.children.length === 0;
	const edits = [{
		from: position,
		to: position,
		insert: placed.insert
	}];
	if (graphRead.edges.length > 0 || graphRead.groups.length > 0) edits.push(mergeGraphSplice(doc.source, doc, graphRead.edges, graphRead.groups, ending));
	return {
		edits,
		selection: {
			kind: "insert",
			edit: 0,
			offset: placed.leading + marker
		},
		verify(next, selection) {
			const created = nodeByLabelStart(next, selection);
			if (!created) throw shape("The pasted root did not survive parsing");
			if (created.parent !== node.id && !(emptyRoot && created.id === next.root)) throw shape("The pasted subtree landed in the wrong place");
			if (countSubtree(next, created) !== count) throw shape("The pasted subtree changed shape");
			if (contentNodeCount(next) !== contentNodeCount(doc) + count) throw shape("The pasted content changed the node count");
			const insertedStart = selection - marker;
			if (next.source.slice(insertedStart, insertedStart + moved.length) !== moved) throw shape("The pasted block changed");
			const target = next.nodes.get(node.id);
			if (target && target.id !== created.id) {
				if (!(target.notes.length === node.notes.length && target.notes.every((note, index) => {
					const before = node.notes[index];
					return before !== void 0 && note.range.start === before.range.start && note.range.end === before.range.end && note.fence === before.fence;
				}))) throw shape("The pasted notes attached to the target");
			}
			const targetNotes = emptyRoot && created.id === next.root ? node.notes : [];
			const expectedAllTexts = [...targetNotes.map((note) => normalizeNoteText(noteText(doc, node, note))), ...expectedTexts];
			const expectedAllFences = [...targetNotes.map((note) => note.fence), ...expectedFences];
			const expectedRanges = [...targetNotes.map((note) => note.range), ...movedNotes.map((note) => ({
				start: insertedStart + note.range.start,
				end: insertedStart + note.range.end
			}))];
			if (created.notes.length !== expectedAllTexts.length) throw shape("The pasted root lost or gained notes");
			for (let index = 0; index < created.notes.length; index += 1) {
				const note = created.notes[index];
				const range = expectedRanges[index];
				if (!note || !range || note.fence !== expectedAllFences[index]) throw shape("The pasted note fences changed");
				if (note.range.start !== range.start || note.range.end !== range.end) throw shape("The pasted note ranges changed");
				if (normalizeNoteText(noteText(next, created, note)) !== expectedAllTexts[index]) throw shape("The pasted note text changed");
				if (index >= targetNotes.length && (note.range.start < insertedStart || note.range.end > insertedStart + moved.length)) throw shape("The pasted note is outside the inserted block");
			}
			if (!created.label || firstLine(next.source, created.label.start).replace(/\r$/u, "") !== expected) throw shape("The pasted label did not survive parsing");
			const fresh = newConventionIssues(doc, next);
			if ((graphRead.edges.length > 0 || graphRead.groups.length > 0) && fresh.length > 0) throw shape(`The paste produced invalid graph metadata: ${fresh[0]?.message ?? ""}`);
		}
	};
}
function selectedSiblings(doc, ids, emptyMessage) {
	if (!ids.length) throw new EditError("E_SHAPE", emptyMessage);
	const seen = /* @__PURE__ */ new Set();
	for (const id of ids) {
		if (seen.has(id)) throw new EditError("E_SHAPE", "The node set repeats a node", id);
		seen.add(id);
	}
	const nodes = ids.map((id) => nodeOf(doc, id));
	const parentId = nodes[0].parent;
	if (parentId === null) throw new EditError("E_CAPABILITY", "The root cannot be selected", doc.root);
	if (nodes.some((node) => node.parent !== parentId)) {
		if (nodes.some((node) => node.parent === null)) throw new EditError("E_CAPABILITY", "The root cannot be selected", doc.root);
		throw new EditError("E_SHAPE", "The selected nodes have different parents", nodes[0].id);
	}
	return {
		nodes,
		parent: nodeOf(doc, parentId)
	};
}
function requireDeletable(node) {
	if (node.opaque) throw new EditError("E_CAPABILITY", "The node cannot be deleted in a batch", node.id);
}
function requireMovable(node) {
	if (node.opaque) throw new EditError("E_CAPABILITY", "The node cannot be moved in a batch", node.id);
}
function mergeCuts(cuts) {
	const merged = [];
	for (const cut of cuts.toSorted((a, b) => a.start - b.start)) {
		const last = merged.at(-1);
		if (last && cut.start <= last.end) last.end = Math.max(last.end, cut.end);
		else merged.push({
			start: cut.start,
			end: cut.end
		});
	}
	return merged;
}
function deleteSelectionOffset(doc, selection, firstIndex, lastIndex) {
	const parent = selection.parent;
	const previousId = firstIndex > 0 ? parent.children[firstIndex - 1] : void 0;
	const previousLabel = (previousId ? doc.nodes.get(previousId) : void 0)?.label;
	if (previousLabel) return previousLabel.start;
	if (parent.label) return parent.label.start;
	const nextId = parent.children[lastIndex + 1];
	const nextLabel = (nextId ? doc.nodes.get(nextId) : void 0)?.label;
	if (nextLabel) return nextLabel.start;
	return doc.source.length;
}
function planDelete(doc, node) {
	requireCapability(node, "delete");
	if (!node.block || !node.parent) throw shape("The node cannot be removed");
	const cut = cutRange(doc.source, node.block);
	const parent = nodeOf(doc, node.parent);
	const index = parent.children.indexOf(node.id);
	const target = (index > 0 ? doc.nodes.get(parent.children[index - 1]) : void 0)?.label?.start ?? parent.label?.start ?? parent.block?.start ?? 0;
	const removed = countSubtree(doc, node);
	const removal = removeGraphNodes(doc, subtreeIds(doc, node.id));
	const edits = [{
		from: cut.start,
		to: cut.end,
		insert: ""
	}];
	edits.push(...graphBlockSplices(doc.source, doc, removal, cut));
	edits.push(...markerRemovalSplices(doc.source, removal));
	return {
		edits,
		selection: {
			kind: "source",
			offset: target
		},
		verify(next) {
			if (contentNodeCount(next) !== contentNodeCount(doc) - removed) throw shape("The node count did not shrink");
			if (next.nodes.has(node.id)) throw shape("The removed node is still present");
			const fresh = newConventionIssues(doc, next);
			if (removal.changed && fresh.length > 0) throw shape(`The delete produced invalid graph metadata: ${fresh[0]?.message ?? ""}`);
		}
	};
}
function planDeleteNodes(doc, ids) {
	const selection = selectedSiblings(doc, ids, "The delete set is empty");
	for (const node of selection.nodes) requireDeletable(node);
	const indices = selection.nodes.map((node) => selection.parent.children.indexOf(node.id)).toSorted((left, right) => left - right);
	const target = deleteSelectionOffset(doc, selection, indices[0], indices[indices.length - 1]);
	const cuts = mergeCuts(selection.nodes.map((node) => node.block).filter((block) => Boolean(block)).map((block) => cutRange(doc.source, block)));
	const removed = selection.nodes.reduce((total, node) => total + countSubtree(doc, node), 0);
	return {
		edits: cuts.map((cut) => ({
			from: cut.start,
			to: cut.end,
			insert: ""
		})),
		selection: {
			kind: "source",
			offset: target
		},
		verify(next) {
			const vanished = selection.nodes.every((node) => !next.nodes.has(node.id));
			if (contentNodeCount(next) !== contentNodeCount(doc) - removed || !vanished) throw shape("The batch delete did not survive parsing");
		}
	};
}
function planOutdent(doc, node) {
	requireCapability(node, "outdent");
	if (!node.block || !node.parent) throw shape("The node cannot be outdented");
	const parent = nodeOf(doc, node.parent);
	const grand = parent.parent ? doc.nodes.get(parent.parent) : void 0;
	if (!grand) throw new EditError("E_CAPABILITY", "The node has no grandparent", node.id);
	const ending = lineEnding(doc.source);
	const cut = cutRange(doc.source, node.block);
	const blockText = doc.source.slice(node.block.start, node.block.end);
	let moved;
	if (node.kind === "listItem" && parent.kind === "listItem") {
		if (!node.list || !parent.list) throw shape("The list item has no list info");
		moved = dedentList(blockText, node.list.indent, parent.list.indent, ending);
	} else if (node.kind === "heading" && parent.kind === "heading") moved = dedentHeadings(doc, node, node.level - parent.level, ending);
	else throw new EditError("E_CAPABILITY", "The node cannot be outdented", node.id);
	const markerLength = firstLineMarker(moved);
	let target = parent.block ? parent.block.end : 0;
	const newline = newlineLengthAt(doc.source, target);
	if (newline) target += newline;
	if (target > cut.start && target < cut.end) throw shape("The move target is inside the source block");
	const before = target === cut.end ? cut.start - 1 : target - 1;
	const atLineStart = before < 0 || doc.source[before] === "\n";
	const following = target < doc.source.length || target === doc.source.length && doc.source.endsWith(ending);
	const placed = placeBlock(moved, ending, atLineStart, following);
	return {
		edits: [{
			from: cut.start,
			to: cut.end,
			insert: ""
		}, {
			from: target,
			to: target,
			insert: placed.insert
		}],
		selection: {
			kind: "insert",
			edit: 1,
			offset: placed.leading + markerLength
		},
		verify(next, selection) {
			if (contentNodeCount(next) !== contentNodeCount(doc)) throw shape("The node count changed");
			const found = nodeByLabelStart(next, selection);
			if (!found || found.parent !== grand.id) throw shape("The outdented node has the wrong parent");
			if (!found.label || labelText(doc, node) !== next.source.slice(found.label.start, found.label.end)) throw shape("The outdented label changed");
		}
	};
}
function childHeadingLevel(parent) {
	if (parent.kind === "root") return parent.block ? parent.level + 1 : 1;
	return parent.level + 1;
}
function childListIndent(doc, parent) {
	for (const id of parent.children) {
		const child = doc.nodes.get(id);
		if (child?.kind === "listItem" && child.list) return child.list.indent;
	}
	if (parent.kind !== "listItem" || !parent.list) return "";
	const unit = doc.unit;
	const indent = parent.list.indent;
	if (unit === "	" || unit.length >= parent.list.marker.length + 1) return indent + unit;
	return indent + " ".repeat(parent.list.marker.length + 1);
}
function reindentListTo(text, fromIndent, toIndent, ending) {
	if (fromIndent === toIndent) return text;
	return text.split(ending).map((line) => {
		if (!line.trim()) return line;
		if (!line.startsWith(fromIndent)) return line;
		return toIndent + line.slice(fromIndent.length);
	}).join(ending);
}
function trimBlockEdges(block, ending) {
	const lines = block.split(ending);
	while (!lines[0]?.trim()) lines.shift();
	while (!lines[lines.length - 1]?.trim()) lines.pop();
	return lines.join(ending);
}
function cutForMove(source, node, block) {
	const cut = cutRange(source, block);
	if (node.kind !== "listItem") return cut;
	if (cut.end >= source.length) {
		const start = lineStart(source, cut.start);
		if (start === 0) return cut;
		const previous = lineStart(source, start - 1);
		if (!source.slice(previous, start).trim()) return {
			start: previous,
			end: cut.end
		};
		return cut;
	}
	const end = lineEnd(source, cut.end);
	if (source.slice(cut.end, end).trim()) return cut;
	return {
		start: cut.start,
		end: end + newlineLengthAt(source, end)
	};
}
function hasBlankBefore(source, position) {
	return /(?:\r?\n)[ \t]*(?:\r?\n)$/u.test(source.slice(0, position));
}
function nextTextStartsWithHeading(source, position) {
	const rest = source.slice(position).replace(/^(?:[ \t]*(?:\r\n|\n))*/u, "");
	return /^#{1,6}(?:[ \t]|$)/u.test(rest);
}
function isInSubtree(doc, ancestorId, id) {
	let cursor = doc.nodes.get(id);
	while (cursor) {
		if (cursor.id === ancestorId) return true;
		cursor = cursor.parent ? doc.nodes.get(cursor.parent) : void 0;
	}
	return false;
}
function planMove(doc, node, parentId, index) {
	requireCapability(node, "move");
	if (node.opaque || node.kind === "opaque" || !node.block) throw new EditError("E_CAPABILITY", "The node cannot be moved", node.id);
	const parent = nodeOf(doc, parentId);
	if (parent.opaque || parent.kind === "opaque" || !parent.capabilities.addChild) throw new EditError("E_CAPABILITY", "The target cannot hold a child", parent.id);
	if (isInSubtree(doc, node.id, parent.id)) throw new EditError("E_CYCLE", "A node cannot move under its own subtree", node.id);
	if (!Number.isInteger(index) || index < 0) throw new EditError("E_SHAPE", "The move index is invalid", node.id);
	const siblings = parent.children.filter((id) => id !== node.id);
	if (index > siblings.length) throw new EditError("E_SHAPE", "The move index is outside the target", node.id);
	if (node.parent === parent.id && parent.children.indexOf(node.id) === index) return {
		edits: [],
		selection: {
			kind: "source",
			offset: node.label?.start ?? node.block.start
		},
		verify() {}
	};
	const list = node.list;
	if (node.kind === "listItem" && !list) throw shape("The list item has no list info");
	const previous = index > 0 ? doc.nodes.get(siblings[index - 1]) : void 0;
	const next = index < siblings.length ? doc.nodes.get(siblings[index]) : void 0;
	const ending = lineEnding(doc.source);
	const block = doc.source.slice(node.block.start, node.block.end);
	let moved;
	if (node.kind === "heading") {
		if (parent.kind === "listItem") moved = headingsToList(block, childIndent(doc, parent), doc.unit, ending);
		else moved = shiftHeadings(block, childHeadingLevel(parent) - node.level, ending);
	} else if (node.kind === "listItem" && list) {
		if (parent.kind === "listItem") moved = reindentListTo(block, list.indent, childListIndent(doc, parent), ending);
		else if (previous?.kind === "heading") {
			if (labelText(doc, node).includes("\n")) throw new EditError("E_LABEL", "A heading label cannot contain a line break", node.id);
			moved = listToHeadings(block, childHeadingLevel(parent), ending);
		} else moved = reindentListTo(block, list.indent, childListIndent(doc, parent), ending);
	} else throw new EditError("E_CAPABILITY", "The node cannot be moved", node.id);
	let position;
	if (next?.block) position = next.block.start;
	else if (previous?.block) position = previous.block.end + newlineLengthAt(doc.source, previous.block.end);
	else if (parent.block) position = parent.block.end + newlineLengthAt(doc.source, parent.block.end);
	else position = doc.source.length;
	const cut = cutForMove(doc.source, node, node.block);
	let gapEnd = position;
	while (gapEnd < doc.source.length) {
		const end = lineEnd(doc.source, gapEnd);
		if (doc.source.slice(gapEnd, end).trim()) break;
		gapEnd = end + newlineLengthAt(doc.source, end);
	}
	if (position < cut.end && gapEnd > cut.start) gapEnd = cut.start;
	const gap = gapEnd - position;
	let text = trimBlockEdges(moved, ending);
	const startsHeading = /^#{1,6}(?:[ \t]|$)/u.test(text);
	const blankBefore = gap === 0 && hasBlankBefore(doc.source, position);
	let leading = 0;
	if (startsHeading && parent.kind !== "listItem" && !blankBefore) {
		text = ending + text;
		leading = ending.length;
	}
	const afterCut = gapEnd >= cut.start && gapEnd <= cut.end ? cut.end : gapEnd;
	if (afterCut < doc.source.length && nextTextStartsWithHeading(doc.source, afterCut)) text += ending + ending;
	const before = position === cut.end ? cut.start - 1 : position - 1;
	const atLineStart = before < 0 || doc.source[before] === "\n";
	const following = gapEnd < doc.source.length || gapEnd === doc.source.length && doc.source.endsWith(ending);
	const placed = placeBlock(text, ending, atLineStart, following);
	const edits = [{
		from: cut.start,
		to: cut.end,
		insert: ""
	}, gap > 0 ? {
		from: position,
		to: gapEnd,
		insert: placed.insert
	} : {
		from: position,
		to: position,
		insert: placed.insert
	}];
	return {
		edits,
		selection: {
			kind: "insert",
			edit: 1,
			offset: placed.leading + leading + firstLineMarker(moved)
		},
		verify(nextDoc, selection) {
			if (contentNodeCount(nextDoc) !== contentNodeCount(doc)) throw shape("The move changed the node count");
			const target = parent.block ? nodeByBlockStart(nextDoc, mapOffset(edits, parent.block.start)) : nextDoc.nodes.get(nextDoc.root);
			if (!target) throw shape("The target parent is missing");
			const found = nodeByLabelStart(nextDoc, selection);
			if (!found || found.parent !== target.id) throw shape("The moved node has the wrong parent");
			if (target.children.indexOf(found.id) !== index) throw shape("The moved node has the wrong order");
			if (!found.label || labelText(doc, node) !== nextDoc.source.slice(found.label.start, found.label.end)) throw shape("The moved label changed");
		}
	};
}
function moveNodeBlock(doc, node, range, parent, afterHeading, ending) {
	const block = doc.source.slice(range.start, range.end);
	if (node.kind === "heading") return {
		text: trimBlockEdges(parent.kind === "listItem" ? headingsToList(block, childIndent(doc, parent), doc.unit, ending) : shiftHeadings(block, childHeadingLevel(parent) - node.level, ending), ending),
		heading: parent.kind !== "listItem"
	};
	const indent = node.list?.indent ?? /^[ \t]*/u.exec(block)?.[0] ?? "";
	if (parent.kind === "listItem") return {
		text: trimBlockEdges(reindentListTo(block, indent, childListIndent(doc, parent), ending), ending),
		heading: false
	};
	if (afterHeading) {
		if (labelText(doc, node).includes("\n")) throw new EditError("E_LABEL", "A heading label cannot contain a line break", node.id);
		return {
			text: trimBlockEdges(listToHeadings(block, childHeadingLevel(parent), ending), ending),
			heading: true
		};
	}
	return {
		text: trimBlockEdges(reindentListTo(block, indent, childListIndent(doc, parent), ending), ending),
		heading: false
	};
}
function joinMovedBlocks(blocks, ending) {
	let text = blocks[0].text;
	for (let index = 1; index < blocks.length; index += 1) {
		const block = blocks[index];
		const before = blocks[index - 1];
		text += before.heading || block.heading ? ending + ending : ending;
		text += block.text;
	}
	return text;
}
function comparableLabel(doc, node) {
	return labelText(doc, node).split(/\r?\n/u).map((line) => line.trimStart()).join("\n");
}
function planMoveNodes(doc, ids, parentId, index) {
	const selection = selectedSiblings(doc, ids, "The move set is empty");
	const parent = nodeOf(doc, parentId);
	if (parent.opaque) throw new EditError("E_CAPABILITY", "The target cannot hold a child", parent.id);
	for (const node of selection.nodes) {
		requireMovable(node);
		if (isInSubtree(doc, node.id, parent.id)) throw new EditError("E_CYCLE", "A node cannot move under its own subtree", node.id);
	}
	if (!Number.isInteger(index) || index < 0) throw new EditError("E_SHAPE", "The move index is invalid", parent.id);
	const selected = new Set(selection.nodes.map((node) => node.id));
	const siblings = parent.children.filter((id) => !selected.has(id));
	if (index > siblings.length) throw new EditError("E_SHAPE", "The move index is outside the target", parent.id);
	const sourceParent = selection.parent;
	const orderedIds = sourceParent.children.filter((id) => selected.has(id));
	const items = orderedIds.map((id) => nodeOf(doc, id)).map((node) => ({
		node,
		block: node.block
	})).filter((item) => Boolean(item.block));
	const first = items[0];
	const firstBlock = doc.source.slice(first.block.start, first.block.end);
	const labelOffset = first.block.start + firstLineMarker(firstBlock);
	const destinationPrevious = index > 0 ? doc.nodes.get(siblings[index - 1]) : void 0;
	const destinationNext = index < siblings.length ? doc.nodes.get(siblings[index]) : void 0;
	let position = doc.source.length;
	if (destinationNext?.block) position = destinationNext.block.start;
	else if (destinationPrevious?.block) position = destinationPrevious.block.end + newlineLengthAt(doc.source, destinationPrevious.block.end);
	else if (parent.block) position = parent.block.end + newlineLengthAt(doc.source, parent.block.end);
	const after = [
		...siblings.slice(0, index),
		...orderedIds,
		...siblings.slice(index)
	];
	if (sourceParent.id === parent.id && after.join("\0") === parent.children.join("\0")) return {
		edits: [],
		selection: {
			kind: "source",
			offset: labelOffset
		},
		verify() {}
	};
	const ending = lineEnding(doc.source);
	let afterHeading = destinationPrevious?.kind === "heading";
	const blocks = [];
	for (const item of items) {
		const block = moveNodeBlock(doc, item.node, item.block, parent, afterHeading, ending);
		blocks.push(block);
		afterHeading = block.heading;
	}
	const moved = joinMovedBlocks(blocks, ending);
	const cuts = mergeCuts(items.map((item) => cutForMove(doc.source, item.node, item.block)));
	for (const cut of cuts) if (position > cut.start && position < cut.end) position = cut.start;
	let gapEnd = position;
	while (gapEnd < doc.source.length) {
		const end = lineEnd(doc.source, gapEnd);
		if (doc.source.slice(gapEnd, end).trim()) break;
		gapEnd = end + newlineLengthAt(doc.source, end);
	}
	for (const cut of cuts) if (gapEnd > cut.start && gapEnd <= cut.end && cut.start >= position) gapEnd = cut.start;
	const gap = gapEnd - position;
	let afterCut = gapEnd;
	for (const cut of cuts) if (gapEnd >= cut.start && gapEnd <= cut.end) afterCut = Math.max(afterCut, cut.end);
	let text = moved;
	const startsHeading = /^#{1,6}(?:[ \t]|$)/u.test(text);
	const cutAtEnd = cuts.find((cut) => cut.end === position);
	const anchor = cutAtEnd ? cutAtEnd.start : position;
	const blankBefore = gap === 0 && hasBlankBefore(doc.source, anchor);
	let leading = 0;
	if (startsHeading && parent.kind !== "listItem" && !blankBefore) {
		text = ending + text;
		leading = ending.length;
	}
	if (afterCut < doc.source.length && nextTextStartsWithHeading(doc.source, afterCut)) text += ending + ending;
	const before = cutAtEnd ? cutAtEnd.start - 1 : position - 1;
	const atLineStart = before < 0 || doc.source[before] === "\n";
	const following = gapEnd < doc.source.length || gapEnd === doc.source.length && doc.source.endsWith(ending);
	const placed = placeBlock(text, ending, atLineStart, following);
	const edits = cuts.map((cut) => ({
		from: cut.start,
		to: cut.end,
		insert: ""
	}));
	edits.push(gap > 0 ? {
		from: position,
		to: gapEnd,
		insert: placed.insert
	} : {
		from: position,
		to: position,
		insert: placed.insert
	});
	return {
		edits,
		selection: {
			kind: "insert",
			edit: cuts.length,
			offset: placed.leading + leading + firstLineMarker(blocks[0].text)
		},
		verify(next) {
			if (contentNodeCount(next) !== contentNodeCount(doc)) throw shape("The batch move changed the node count");
			if (items.length !== ids.length) throw shape("The batch move lost a selected block");
			const target = parent.block ? nodeByBlockStart(next, mapOffset(edits, parent.block.start)) : next.nodes.get(next.root);
			if (!target) throw shape("The batch move lost the target");
			const children = target.children.slice(index, index + ids.length);
			if (children.length !== ids.length) throw shape("The batch move did not place every moved node");
			for (let offset = 0; offset < items.length; offset += 1) {
				const child = next.nodes.get(children[offset]);
				if (!child || child.parent !== target.id) throw shape("The moved node has the wrong parent");
				if (comparableLabel(next, child) !== comparableLabel(doc, items[offset].node)) throw shape("The moved label changed");
				if (countSubtree(next, child) !== countSubtree(doc, items[offset].node)) throw shape("The moved subtree changed");
			}
		}
	};
}
function planToggleCheck(doc, node) {
	requireCapability(node, "toggleCheck");
	if (!node.block || !node.label) throw shape("The task has no block");
	const line = doc.source.slice(node.block.start, lineEnd(doc.source, node.block.start));
	const match = /^([ \t]*(?:[-+*]|\d{1,9}[.)])[ \t]+)(\[[ xX]\])/.exec(line);
	if (!match) throw shape("The task checkbox is missing");
	const from = node.block.start + match[1].length;
	const insert = match[2] === "[ ]" ? "[x]" : "[ ]";
	return {
		edits: [{
			from,
			to: from + 3,
			insert
		}],
		selection: {
			kind: "source",
			offset: node.label.start
		},
		verify(next, selection) {
			if (contentNodeCount(next) !== contentNodeCount(doc)) throw shape("The node count changed");
			const found = nodeByLabelStart(next, selection);
			if (!found || found.block?.start !== node.block?.start) throw shape("The task changed shape");
		}
	};
}
function nodeOf(doc, id) {
	const node = doc.nodes.get(id);
	if (!node) throw new EditError("E_NODE", `No node with id ${id}`, id);
	return node;
}
function requireCapability(node, key) {
	if (!node.capabilities[key]) throw new EditError("E_CAPABILITY", `The node does not support ${key}`, node.id);
}
function nodeByLabelStart(doc, offset) {
	for (const id of doc.order) {
		const node = doc.nodes.get(id);
		if (node?.label?.start === offset) return node;
	}
}
function nodeByBlockStart(doc, offset) {
	for (const id of doc.order) {
		const node = doc.nodes.get(id);
		if (node?.block?.start === offset) return node;
	}
}
function countSubtree(doc, node) {
	let count = 1;
	for (const id of node.children) {
		const child = doc.nodes.get(id);
		if (child) count += countSubtree(doc, child);
	}
	return count;
}
function shape(message) {
	return new EditError("E_SHAPE", message);
}
export { EditError, appendGraphSplice, applyCommand, applySplices, copyBlock, graphBlockSplices, lineEnding, mapOffset, markerRemovalSplices, mergeGraphSplice, readPastedGraph, removeGraphNodes, rootHeadingRefusal, subtreeIds };
