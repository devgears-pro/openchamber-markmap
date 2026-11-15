import { HEADING_MARKER, LIST_MARKER, firstLine, labelText, lineEnd, parseDocument, validateDocument } from "@markmap/model";
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
	const atLineStart = position === 0 || source[position - 1] === "\n";
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
	if (position === 0 || source[position - 1] === "\n") return {
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
	const node = nodeOf(doc, command.node);
	switch (command.type) {
		case "setLabel": return planSetLabel(doc, node, command.text);
		case "insertFirst": return planInsertFirst(doc, node, command.text);
		case "insertChild": return planInsert(doc, node, command.text ?? "", "child");
		case "insertSibling": return planInsert(doc, node, command.text ?? "", "sibling");
		case "insertBlock": return planInsertBlock(doc, node, command.text);
		case "delete": return planDelete(doc, node);
		case "outdent": return planOutdent(doc, node);
		case "toggleCheck": return planToggleCheck(doc, node);
	}
}
function planSetLabel(doc, node, raw) {
	requireCapability(node, "editLabel");
	if (!node.label) throw new EditError("E_LABEL", "The node has no editable label", node.id);
	const text = cleanLabel(raw);
	let insert;
	if (node.kind === "heading" || node.kind === "root") {
		assertSingleLine(node, text);
		insert = text;
	} else insert = formatListText(node, text, lineEnding(doc.source));
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
			if (next.nodes.size !== doc.nodes.size) throw shape("The node count changed");
			const found = blockStart == null ? void 0 : nodeByBlockStart(next, blockStart);
			if (!found || found.kind !== node.kind || found.parent !== node.parent) throw shape("The edited node changed shape");
			if (!found.label || next.source.slice(found.label.start, found.label.end) !== insert) throw shape("The label did not survive parsing");
		}
	};
}
function planInsertFirst(doc, node, raw) {
	if (node.kind !== "root" || node.block || node.children.length > 0) throw new EditError("E_CAPABILITY", "The node is not an empty root", node.id);
	const text = cleanLabel(raw);
	if (!text) throw new EditError("E_LABEL", "The label cannot be empty", node.id);
	assertSingleLine(node, text);
	const line = headingLine(1, text);
	const verify = (next, selection) => {
		const created = nodeByLabelStart(next, selection);
		if (!created || !created.block || !created.label || created.kind !== "root" && created.kind !== "heading" || created.level !== 1) throw shape("The first node is not an editable heading");
		if (next.source.slice(created.label.start, created.label.end) !== text) throw shape("The first label did not survive parsing");
		if (next.nodes.size !== 1 && next.nodes.size !== 2) throw shape("The first node changed the node count");
	};
	if (doc.source.trim() === "") return {
		edits: [{
			from: 0,
			to: doc.source.length,
			insert: line
		}],
		selection: {
			kind: "insert",
			edit: 0,
			offset: 2
		},
		verify
	};
	const position = doc.source.length;
	const inserted = insertLine(doc.source, position, line, lineEnding(doc.source));
	return {
		edits: [{
			from: position,
			to: position,
			insert: inserted.insert
		}],
		selection: {
			kind: "insert",
			edit: 0,
			offset: inserted.leading + 2
		},
		verify
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
	if (node.kind === "root") {
		parentId = node.id;
		if (node.block) {
			position = node.block.end;
			if (node.level >= 1 && node.level < 6) {
				assertSingleLine(node, text);
				line = headingLine(node.level + 1, text);
				markerLength = node.level + 2;
			} else {
				line = listLine("", "-", text, ending);
				markerLength = 2;
			}
		} else {
			position = doc.source.length;
			const last = node.children.length ? doc.nodes.get(node.children[node.children.length - 1]) : void 0;
			if (last?.kind === "heading" && last.level >= 1) {
				assertSingleLine(node, text);
				line = headingLine(last.level, text);
				markerLength = last.level + 1;
			} else {
				const indent = last?.kind === "listItem" ? last.list?.indent ?? "" : "";
				const marker = last?.kind === "listItem" ? last.list?.marker ?? "-" : "-";
				line = listLine(indent, marker, text, ending);
				markerLength = indent.length + marker.length + 1;
			}
		}
	} else if (node.kind === "heading") {
		if (!node.block) throw shape("The heading has no block");
		position = node.block.end;
		const level = mode === "sibling" ? node.level : node.level + 1;
		if (level > 6) throw new EditError("E_LEVEL", "Heading level cannot exceed six", node.id);
		assertSingleLine(node, text);
		line = headingLine(level, text);
		markerLength = level + 1;
		parentId = mode === "sibling" ? node.parent ?? node.id : node.id;
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
			if (next.nodes.size !== doc.nodes.size + 1) throw shape("The node count did not grow");
			const created = nodeByLabelStart(next, selection);
			if (!created || created.parent !== parentId) throw shape("The new node landed in the wrong place");
			if (!created.label || next.source.slice(created.label.start, created.label.end) !== expectedLabel) throw shape("The new label did not survive parsing");
		}
	};
}
function normalizeBlockText(raw, ending) {
	const trimmed = raw.replace(/\r\n?/g, "\n").replace(/^(?:[ \t]*\n)+/u, "").replace(/(?:\n[ \t]*)+$/u, "");
	return ending === "\n" ? trimmed : trimmed.replace(/\n/g, ending);
}
function planInsertBlock(doc, node, raw) {
	requireCapability(node, "addChild");
	const ending = lineEnding(doc.source);
	const block = normalizeBlockText(raw, ending);
	if (!block.trim()) throw new EditError("E_LABEL", "The pasted text is empty", node.id);
	const fragment = parseDocument(block).document;
	const fragmentRoot = fragment.nodes.get(fragment.root);
	if (!fragmentRoot) throw shape("The pasted text has no root");
	const top = fragmentRoot.block ? fragmentRoot : fragmentRoot.children.map((id) => fragment.nodes.get(id)).find((child) => Boolean(child?.block));
	if (!top || !top.label) throw new EditError("E_SHAPE", "The pasted text has no editable node", node.id);
	const count = fragment.nodes.size - (fragmentRoot.block ? 0 : 1);
	let moved;
	if (top.kind === "heading" || top.kind === "root") {
		if (node.kind === "listItem") throw new EditError("E_CAPABILITY", "A heading cannot be pasted under a list item", node.id);
		moved = shiftHeadings(block, (node.kind === "root" ? node.block ? node.level : 0 : node.level) + 1 - top.level, ending);
	} else if (top.kind === "listItem") {
		if (!top.list) throw shape("The pasted list item has no list info");
		moved = reindentList(block, (node.kind === "listItem" ? childIndent(doc, node) : "").length - top.list.indent.length, ending);
	} else throw new EditError("E_SHAPE", "The pasted text has no editable node", node.id);
	const position = node.block ? node.block.end : doc.source.length;
	const placed = blockInsertion(doc.source, position, moved, ending);
	const expected = firstLine(fragment.source, top.label.start).replace(/\r$/u, "");
	const emptyRoot = node.kind === "root" && !node.block && node.children.length === 0;
	return {
		edits: [{
			from: position,
			to: position,
			insert: placed.insert
		}],
		selection: {
			kind: "insert",
			edit: 0,
			offset: placed.leading + firstLineMarker(moved)
		},
		verify(next, selection) {
			const created = nodeByLabelStart(next, selection);
			if (!created) throw shape("The pasted root did not survive parsing");
			if (created.parent !== node.id && !(emptyRoot && created.id === next.root)) throw shape("The pasted subtree landed in the wrong place");
			if (countSubtree(next, created) !== count) throw shape("The pasted subtree changed shape");
			if (!created.label || firstLine(next.source, created.label.start).replace(/\r$/u, "") !== expected) throw shape("The pasted label did not survive parsing");
		}
	};
}
function planDelete(doc, node) {
	requireCapability(node, "delete");
	if (!node.block || !node.parent) throw shape("The node cannot be removed");
	const cut = cutRange(doc.source, node.block);
	const parent = nodeOf(doc, node.parent);
	const index = parent.children.indexOf(node.id);
	const target = (index > 0 ? doc.nodes.get(parent.children[index - 1]) : void 0)?.label?.start ?? parent.label?.start ?? parent.block?.start ?? 0;
	const removed = countSubtree(doc, node);
	return {
		edits: [{
			from: cut.start,
			to: cut.end,
			insert: ""
		}],
		selection: {
			kind: "source",
			offset: target
		},
		verify(next) {
			if (next.nodes.size !== doc.nodes.size - removed) throw shape("The node count did not shrink");
			if (next.nodes.has(node.id)) throw shape("The removed node is still present");
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
			if (next.nodes.size !== doc.nodes.size) throw shape("The node count changed");
			const found = nodeByLabelStart(next, selection);
			if (!found || found.parent !== grand.id) throw shape("The outdented node has the wrong parent");
			if (!found.label || labelText(doc, node) !== next.source.slice(found.label.start, found.label.end)) throw shape("The outdented label changed");
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
			if (next.nodes.size !== doc.nodes.size) throw shape("The node count changed");
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
export { EditError, applyCommand, applySplices, lineEnding, mapOffset };
