import { parse } from "@markmap/parse";
import { parse as parse$1 } from "yaml";
// src/source.ts
function lineStart(source, offset) {
	const index = source.lastIndexOf("\n", offset - 1);
	const start = index === -1 ? 0 : index + 1;
	return start === 0 && offset > 0 && source.startsWith("﻿") ? 1 : start;
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
var HEADING_MARKER = /^[ \t]{0,3}(#{1,6})(?:[ \t]+|(?=\r?$))/;
function contentIndent(node) {
	if (node.kind !== "listItem" || !node.list) return "";
	return node.list.indent + " ".repeat(node.list.marker.length + 1);
}
function normalizeNoteText(text) {
	return text.replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[ \t]+$/u, "")).join("\n").replace(/\n+$/u, "");
}
function noteText(doc, node, note) {
	const indent = contentIndent(node);
	const raw = doc.source.slice(note.range.start, note.range.end);
	if (!note.fence) return raw;
	return raw.replace(/\r\n?/g, "\n").split("\n").slice(1, -1).map((line) => indent && line.startsWith(indent) ? line.slice(indent.length) : line).join("\n");
}
function notesText(doc, node) {
	return normalizeNoteText([...node.notes].toSorted((a, b) => a.range.start - b.range.start).map((note) => noteText(doc, node, note)).join("\n\n"));
}
// src/conventions.ts
var IDENTITY_COMMENT = /<!--[ \t]*\^([\s\S]*?)-->/g;
var GRAPH_ANY = /<!--[ \t]*markmap:[ \t]*graph\b/g;
var GRAPH_START = /^<!--[ \t]*markmap:[ \t]*graph(?=[ \t\r\n]|-->)/;
var ID = /^[A-Za-z0-9]{1,3}$/;
var REF = /^(?:root|[A-Za-z0-9]{1,3})$/;
var ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
var UNSAFE = /<!--|-->/;
var GraphShapeError = class extends Error {};
function emptyGraph(block) {
	return {
		edges: [],
		groups: [],
		block
	};
}
function addIssue(issues, code, message, range, nodeId) {
	const issue = {
		code,
		message
	};
	if (range !== void 0) issue.range = range;
	if (nodeId !== void 0) issue.nodeId = nodeId;
	issues.push(issue);
}
function readConventions(source, nodes, order, rootId, bodyStart, htmlBlocks) {
	const issues = [];
	const graphRead = readGraph(source, htmlBlocks, issues);
	const identityRead = readIdentities(source, nodes, order, rootId, bodyStart, graphRead.graph.block, issues);
	for (const node of nodes.values()) node.identity = identityRead.markers.get(node.id) ?? null;
	validateGraph(graphRead.graph, graphRead.valid, identityRead.identities, nodes, rootId, issues);
	return {
		identities: identityRead.identities,
		graph: graphRead.graph,
		issues
	};
}
function validateConventions(doc) {
	return [...doc.conventionIssues];
}
function issueKey(issue) {
	return `${issue.code}|${issue.message}|${issue.nodeId ?? ""}`;
}
function newConventionIssues(before, after) {
	const counts = /* @__PURE__ */ new Map();
	for (const issue of before.conventionIssues) {
		const key = issueKey(issue);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return after.conventionIssues.filter((issue) => {
		const key = issueKey(issue);
		const count = counts.get(key) ?? 0;
		if (count > 0) {
			counts.set(key, count - 1);
			return false;
		}
		return true;
	});
}
function isGraphBlock(block) {
	return GRAPH_START.test(block.value.trimStart());
}
function graphOccurrences(source) {
	const starts = [];
	GRAPH_ANY.lastIndex = 0;
	let match = GRAPH_ANY.exec(source);
	while (match !== null) {
		starts.push(match.index);
		match = GRAPH_ANY.exec(source);
	}
	return starts;
}
function readGraph(source, htmlBlocks, issues) {
	const candidates = htmlBlocks.filter(isGraphBlock);
	const occurrences = graphOccurrences(source);
	if (candidates.length > 1) {
		for (const extra of candidates.slice(1)) addIssue(issues, "E_GRAPH", "The document has more than one graph block", extra.range);
		const known = new Set(candidates.map((candidate) => candidate.range.start));
		for (const start of occurrences) if (!known.has(start)) addIssue(issues, "E_GRAPH", "The graph block must be a single root-level block", {
			start,
			end: start
		});
		return {
			graph: emptyGraph(candidates[0].range),
			valid: false
		};
	}
	if (candidates.length === 0) {
		for (const start of occurrences) addIssue(issues, "E_GRAPH", "The graph block must be a root-level HTML block", {
			start,
			end: start
		});
		return {
			graph: emptyGraph(null),
			valid: occurrences.length === 0
		};
	}
	const candidate = candidates[0];
	const known = /* @__PURE__ */ new Set([candidate.range.start]);
	for (const start of occurrences) if (!known.has(start)) addIssue(issues, "E_GRAPH", "The document has more than one graph block", {
		start,
		end: start
	});
	const parsed = parseGraphBlock(candidate.value);
	if (!parsed.ok) {
		addIssue(issues, "E_GRAPH", parsed.message, candidate.range);
		return {
			graph: emptyGraph(candidate.range),
			valid: false
		};
	}
	return {
		graph: {
			edges: parsed.edges,
			groups: parsed.groups,
			block: candidate.range
		},
		valid: true
	};
}
function parseGraphBlock(value) {
	const text = value.trim();
	if (!text.endsWith("-->")) return {
		ok: false,
		message: "The graph block is not a closed HTML comment"
	};
	const open = text.indexOf("graph") + 5;
	const payload = text.slice(open, text.length - 3).trim();
	if (UNSAFE.test(payload)) return {
		ok: false,
		message: "Graph metadata cannot contain an HTML comment delimiter"
	};
	if (!payload) return {
		ok: true,
		edges: [],
		groups: []
	};
	let data;
	try {
		data = parse$1(payload);
	} catch {
		return {
			ok: false,
			message: "The graph metadata is not valid YAML"
		};
	}
	try {
		return {
			ok: true,
			...readGraphData(data)
		};
	} catch (error) {
		if (error instanceof GraphShapeError) return {
			ok: false,
			message: error.message
		};
		throw error;
	}
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertKeys(value, allowed, label) {
	for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new GraphShapeError(`${label} has an unknown field "${key}"`);
}
function readGraphData(value) {
	if (value === null || value === void 0) return {
		edges: [],
		groups: []
	};
	if (!isRecord(value)) throw new GraphShapeError("The graph metadata must be a mapping");
	assertKeys(value, ["edges", "groups"], "The graph metadata");
	return {
		edges: readEdges(value["edges"]),
		groups: readGroups(value["groups"])
	};
}
function readEdges(value) {
	if (value === void 0) return [];
	if (!Array.isArray(value)) throw new GraphShapeError("The edges must be a sequence");
	return value.map((entry, index) => readEdge(entry, index));
}
function readEdge(value, index) {
	const label = `Edge ${index + 1}`;
	if (!isRecord(value)) throw new GraphShapeError(`${label} must be a mapping`);
	assertKeys(value, [
		"from",
		"to",
		"label"
	], label);
	return {
		from: readRef(value["from"], `${label} from`),
		to: readRef(value["to"], `${label} to`),
		label: readLabel(value["label"], label)
	};
}
function readGroups(value) {
	if (value === void 0) return [];
	if (!Array.isArray(value)) throw new GraphShapeError("The groups must be a sequence");
	return value.map((entry, index) => readGroup(entry, index));
}
function readGroup(value, index) {
	const label = `Group ${index + 1}`;
	if (!isRecord(value)) throw new GraphShapeError(`${label} must be a mapping`);
	assertKeys(value, ["roots", "label"], label);
	const roots = value["roots"];
	if (!Array.isArray(roots) || roots.length === 0) throw new GraphShapeError(`${label} must have at least one root`);
	return {
		roots: roots.map((root, rootIndex) => readRef(root, `${label} root ${rootIndex + 1}`)),
		label: readLabel(value["label"], label)
	};
}
function readRef(value, label) {
	if (typeof value !== "string" || !REF.test(value)) throw new GraphShapeError(`${label} must be root or a one-to-three character node id`);
	return value;
}
function readLabel(value, label) {
	if (value === void 0) return null;
	if (typeof value !== "string") throw new GraphShapeError(`${label} label must be a string`);
	return value;
}
function identityComments(source) {
	const comments = [];
	IDENTITY_COMMENT.lastIndex = 0;
	let match = IDENTITY_COMMENT.exec(source);
	while (match !== null) {
		const payload = match[1];
		if (payload !== void 0) comments.push({
			start: match.index,
			end: match.index + match[0].length,
			payload: payload.trim(),
			multiline: /[\r\n]/.test(match[0])
		});
		match = IDENTITY_COMMENT.exec(source);
	}
	return comments;
}
function readIdentities(source, nodes, order, rootId, bodyStart, graphBlock, issues) {
	const identities = /* @__PURE__ */ new Map();
	const markers = /* @__PURE__ */ new Map();
	identities.set("root", rootId);
	if (nodes.has(rootId)) markers.set(rootId, {
		id: "root",
		range: null
	});
	const lineNodes = /* @__PURE__ */ new Map();
	for (const id of order) {
		const node = nodes.get(id);
		if (node?.block) lineNodes.set(node.block.start, node);
	}
	const comments = identityComments(source);
	const lineCounts = /* @__PURE__ */ new Map();
	for (const comment of comments) {
		const line = lineStart(source, comment.start);
		lineCounts.set(line, (lineCounts.get(line) ?? 0) + 1);
	}
	const reportedLines = /* @__PURE__ */ new Set();
	for (const comment of comments) {
		const range = {
			start: comment.start,
			end: comment.end
		};
		const line = lineStart(source, comment.start);
		const node = lineNodes.get(line);
		if (comment.multiline) {
			addIssue(issues, "E_IDENTITY", "A node identity marker must stay on one line", range);
			continue;
		}
		if (comment.start < bodyStart && node === void 0) {
			addIssue(issues, "E_IDENTITY", "A node identity cannot live in frontmatter", range);
			continue;
		}
		if (insideGraph(comment.start, graphBlock)) {
			addIssue(issues, "E_GRAPH", "A node identity cannot live in the graph block", range);
			continue;
		}
		const owner = insideNote(comment.start, nodes);
		if (owner !== void 0) {
			addIssue(issues, "E_IDENTITY", owner ? "A node identity cannot live in a note fence" : "A node identity cannot live in a note", range);
			continue;
		}
		if (node !== void 0) {
			if ((lineCounts.get(line) ?? 0) > 1) {
				if (!reportedLines.has(line)) {
					addIssue(issues, "E_IDENTITY", "A node line can carry only one marker", range, node.id);
					reportedLines.add(line);
				}
				continue;
			}
			if (node.kind === "root" && node.block) {
				addIssue(issues, "E_IDENTITY", "The root identity is reserved", range, node.id);
				continue;
			}
			if (!ID.test(comment.payload)) {
				addIssue(issues, "E_IDENTITY", "A node identity is one to three alphanumeric characters", range, node.id);
				continue;
			}
			if (!isFinalToken(source, comment)) {
				addIssue(issues, "E_IDENTITY", "A node identity marker must be the last token on the node line", range, node.id);
				continue;
			}
			const identity = {
				id: comment.payload,
				range
			};
			markers.set(node.id, identity);
			if (identities.has(comment.payload)) addIssue(issues, "E_IDENTITY", `The node identity "${comment.payload}" is declared more than once`, range, node.id);
			else identities.set(comment.payload, node.id);
			continue;
		}
		if (insideNode(comment.start, nodes)) {
			addIssue(issues, "E_IDENTITY", "A node identity must be on its own node line", range);
			continue;
		}
		addIssue(issues, "E_IDENTITY", "A node identity cannot stand alone", range);
	}
	return {
		identities,
		markers
	};
}
function isFinalToken(source, comment) {
	return source.slice(comment.end, lineEnd(source, comment.start)).trim() === "";
}
function insideGraph(offset, block) {
	return block !== null && offset >= block.start && offset < block.end;
}
function insideNote(offset, nodes) {
	for (const node of nodes.values()) for (const note of node.notes) if (offset >= note.range.start && offset < note.range.end) return note.fence;
}
function insideNode(offset, nodes) {
	for (const node of nodes.values()) if (node.block && offset >= node.block.start && offset < node.block.end) return true;
	return false;
}
function validateGraph(graph, valid, identities, nodes, rootId, issues) {
	if (!valid) return;
	const resolve = (ref) => ref === "root" ? rootId : identities.get(ref);
	const seenEdges = /* @__PURE__ */ new Set();
	for (const edge of graph.edges) {
		if (edge.from === edge.to) addIssue(issues, "E_GRAPH", `An edge cannot connect "${edge.from}" to itself`);
		const edgeKey = `${edge.from}->${edge.to}`;
		if (seenEdges.has(edgeKey)) addIssue(issues, "E_GRAPH", `Duplicate edge from "${edge.from}" to "${edge.to}"`);
		else seenEdges.add(edgeKey);
		if (resolve(edge.from) === void 0) addIssue(issues, "E_GRAPH", `The edge endpoint "${edge.from}" has no node`);
		if (resolve(edge.to) === void 0) addIssue(issues, "E_GRAPH", `The edge endpoint "${edge.to}" has no node`);
	}
	const seenRoots = /* @__PURE__ */ new Set();
	const subtrees = [];
	for (const group of graph.groups) {
		if (new Set(group.roots).size !== group.roots.length) addIssue(issues, "E_GRAPH", "A group repeats one of its roots");
		const subtree = /* @__PURE__ */ new Set();
		for (const root of group.roots) {
			if (seenRoots.has(root)) addIssue(issues, "E_GRAPH", `The group root "${root}" is repeated across groups`);
			else seenRoots.add(root);
			const id = resolve(root);
			if (id === void 0) {
				addIssue(issues, "E_GRAPH", `The group root "${root}" has no node`);
				continue;
			}
			for (const descendant of descendants(nodes, id)) subtree.add(descendant);
		}
		subtrees.push(subtree);
	}
	for (let left = 0; left < subtrees.length; left += 1) for (let right = left + 1; right < subtrees.length; right += 1) {
		const a = subtrees[left];
		const b = subtrees[right];
		if ([...a].some((id) => b.has(id))) addIssue(issues, "E_GRAPH", "Group subtrees overlap");
	}
	if (issues.some((issue) => issue.code === "E_GRAPH")) return;
	const referenced = /* @__PURE__ */ new Set();
	for (const edge of graph.edges) {
		referenced.add(edge.from);
		referenced.add(edge.to);
	}
	for (const group of graph.groups) for (const root of group.roots) referenced.add(root);
	for (const id of nodes.keys()) {
		const identity = nodes.get(id)?.identity;
		if (!identity || identity.range === null) continue;
		if (!referenced.has(identity.id)) addIssue(issues, "E_IDENTITY", `The node identity "${identity.id}" is not referenced by an edge or a group`, identity.range, id);
	}
}
function descendants(nodes, id) {
	const result = /* @__PURE__ */ new Set();
	const stack = [id];
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === void 0) continue;
		result.add(current);
		const node = nodes.get(current);
		if (node) for (const child of node.children) stack.push(child);
	}
	return result;
}
function mintIdentity(taken, random) {
	for (const length of [
		1,
		2,
		3
	]) {
		const total = 62 ** length;
		const draw = Math.min(Math.max(random(), 0), .9999999999999999);
		const start = Math.floor(draw * total);
		for (let offset = 0; offset < total; offset += 1) {
			const candidate = encodeIdentity((start + offset) % total, length);
			if (!taken.has(candidate)) return candidate;
		}
	}
	return null;
}
function encodeIdentity(index, length) {
	let value = index;
	let result = "";
	for (let position = 0; position < length; position += 1) {
		result = `${ALPHABET[value % 62]}${result}`;
		value = Math.floor(value / 62);
	}
	return result;
}
function serializeGraphBlock(graph, ending) {
	if (graph.edges.length === 0 && graph.groups.length === 0) return "";
	const lines = ["<!-- markmap: graph"];
	if (graph.edges.length > 0) {
		lines.push("edges:");
		for (const edge of graph.edges) {
			lines.push(`  - from: ${JSON.stringify(edge.from)}`);
			lines.push(`    to: ${JSON.stringify(edge.to)}`);
			if (edge.label !== null) lines.push(`    label: ${JSON.stringify(edge.label)}`);
		}
	}
	if (graph.groups.length > 0) {
		lines.push("groups:");
		for (const group of graph.groups) {
			lines.push(`  - roots: [${group.roots.map((root) => JSON.stringify(root)).join(", ")}]`);
			if (group.label !== null) lines.push(`    label: ${JSON.stringify(group.label)}`);
		}
	}
	lines.push("-->");
	return lines.join(ending);
}
// src/build.ts
function parseDocument(source) {
	const { root, frontmatter, hasTitle, bodyStart, htmlBlocks } = parse(source);
	return {
		document: buildFromTree(source, root, {
			hasTitle,
			bodyStart,
			htmlBlocks
		}),
		tree: root,
		frontmatter
	};
}
function buildDocument(source) {
	return parseDocument(source).document;
}
function contentNodeCount(doc) {
	return doc.nodes.size - (doc.rootPolicy.kind === "source-heading" ? 0 : 1);
}
function buildFromTree(source, root, meta) {
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
	const rootNode = nodes.get(root.id);
	const hasTitle = meta.hasTitle;
	const bodyStart = Math.max(0, Math.min(meta.bodyStart, source.length));
	const kind = rootNode?.block ? "source-heading" : hasTitle ? "title" : "synthetic";
	const headingChild = rootNode?.children.some((id) => nodes.get(id)?.kind === "heading") ?? false;
	const topH1 = rootNode?.children.some((id) => {
		const child = nodes.get(id);
		return child?.kind === "heading" && child.level === 1;
	}) ?? false;
	const rootPolicy = {
		kind,
		hasTitle,
		bodyStart,
		hasHeadingChild: headingChild,
		canCreateHeading: kind === "synthetic" ? !topH1 : kind === "title" ? !headingChild : false
	};
	const conventions = readConventions(source, nodes, order, root.id, bodyStart, meta.htmlBlocks ?? []);
	return {
		source,
		root: root.id,
		nodes,
		order,
		unit,
		rootPolicy,
		identities: conventions.identities,
		graph: conventions.graph,
		conventionIssues: conventions.issues
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
		notes: readNotes(tree, source.length),
		identity: null,
		opaque,
		capabilities: emptyCapabilities()
	};
	node.capabilities = readCapabilities(node, parent, tree.content.length > 0);
	return node;
}
function readNotes(tree, length) {
	const notes = [];
	const seen = /* @__PURE__ */ new Set();
	for (const note of tree.notes) {
		if (!note.source) continue;
		const range = clampRange(note.source, length);
		const key = `${range.start}:${range.end}`;
		if (seen.has(key)) continue;
		seen.add(key);
		notes.push({
			range,
			fence: note.fence === true
		});
	}
	return notes;
}
function readCapabilities(node, parent, hasTitle) {
	const base = {
		editLabel: false,
		editNotes: false,
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
		editNotes: Boolean(node.block) || hasTitle,
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
		editNotes: true,
		addChild: true,
		addSibling: Boolean(parent),
		outdent: parent?.kind === "heading",
		delete: Boolean(parent),
		move: Boolean(parent)
	};
	return {
		...base,
		editLabel: Boolean(node.label && node.block),
		editNotes: true,
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
		editNotes: false,
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
		if (!node?.block) continue;
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
export { HEADING_MARKER, LIST_MARKER, ModelError, assertDocument, buildDocument, buildFromTree, contentIndent, contentNodeCount, firstLine, indentColumns, indentWidth, labelText, lineEnd, lineStart, mintIdentity, newConventionIssues, nodeAtOffset, normalizeNoteText, noteText, notesText, parseDocument, readConventions, serializeGraphBlock, validateConventions, validateDocument };
