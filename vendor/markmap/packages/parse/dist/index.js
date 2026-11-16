import { unified } from "unified";
import { parse as parse$1 } from "yaml";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { splice } from "micromark-util-chunked";
import { classifyCharacter } from "micromark-util-classify-character";
import { resolveAll } from "micromark-util-resolve-all";
import { assignIds } from "@markmap/core";
// src/html-image.ts
var TAG = /^<img((?:\s+[a-z][a-z0-9-]*(?:\s*=\s*(?:"[^"<>]*"|'[^'<>]*'|[^\s"'=<>`]+))?)*)\s*\/?>$/i;
var ATTR = /([a-z][a-z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi;
var PIXELS = /^(\d+(?:\.\d+)?)(?:px)?$/;
var ENTITIES = {
	"&amp;": "&",
	"&quot;": "\"",
	"&#39;": "'",
	"&lt;": "<",
	"&gt;": ">"
};
var decode = (value) => value.replace(/&(?:amp|quot|#39|lt|gt);/g, (e) => ENTITIES[e]);
function pixels(value) {
	const match = value && PIXELS.exec(value.trim());
	const n = match ? Number(match[1]) : 0;
	return n > 0 ? n : void 0;
}
/**
* Read one GitHub-style `<img>` tag: exactly one tag, nothing around it, well-formed
* attributes. Only `src`, `alt`, `width` and `height` are kept; other attributes are
* ignored. Returns `undefined` for anything else, which callers then drop.
*/
function parseHtmlImage(html) {
	const match = TAG.exec(html.trim());
	if (!match) return void 0;
	const attrs = /* @__PURE__ */ new Map();
	for (const [, name, ...values] of match[1].matchAll(ATTR)) {
		const key = name.toLowerCase();
		if (!attrs.has(key)) attrs.set(key, decode(values.find((v) => v != null) ?? ""));
	}
	const src = attrs.get("src")?.trim();
	if (!src) return void 0;
	return {
		src,
		alt: attrs.get("alt") ?? "",
		width: pixels(attrs.get("width")),
		height: pixels(attrs.get("height"))
	};
}
function toImage(html) {
	const parsed = parseHtmlImage(html.value);
	if (!parsed) return void 0;
	const size = {
		...parsed.width && { width: parsed.width },
		...parsed.height && { height: parsed.height }
	};
	return {
		type: "image",
		url: parsed.src,
		alt: parsed.alt,
		data: {
			...size,
			hProperties: size
		}
	};
}
/** Parents whose children are blocks, where an `<img>` line becomes its own paragraph. */
var FLOW = /* @__PURE__ */ new Set([
	"root",
	"listItem",
	"blockquote",
	"footnoteDefinition"
]);
/**
* Turn raw `<img>` tags into `image` nodes, inline and on their own line. All other raw
* HTML is left alone for later steps to drop.
*/
function remarkHtmlImages() {
	const visit = (node) => {
		if (!("children" in node)) return;
		const parent = node;
		parent.children = parent.children.map((child) => {
			if (child.type !== "html") {
				visit(child);
				return child;
			}
			const image = toImage(child);
			if (!image) return child;
			if (!FLOW.has(parent.type)) return image;
			return {
				type: "paragraph",
				children: [image]
			};
		});
	};
	return (tree) => visit(tree);
}
// src/mark.ts
var EQUALS = 61;
var PUNCTUATION = 2;
/** Whether each `==` sequence can open or close a mark, from its flanking characters. */
var sides = /* @__PURE__ */ new WeakMap();
/**
* micromark syntax for `==text==`, modeled on GFM strikethrough: a sequence of exactly two
* `=` with the same flanking rules as `**`. Because it runs in the tokenizer, escapes
* (`\=`), character references (`&#61;`) and code spans are never delimiters.
*/
function markSyntax() {
	const construct = {
		name: "mark",
		tokenize: tokenizeMark,
		resolveAll: resolveAllMark
	};
	return {
		text: { [EQUALS]: construct },
		insideSpan: { null: [construct] },
		attentionMarkers: { null: [EQUALS] }
	};
}
var resolveAllMark = (events, context) => {
	for (let index = 0; index < events.length; index += 1) {
		const closer = events[index][1];
		if (events[index][0] !== "enter" || closer.type !== "markSequenceTemporary" || !sides.get(closer)?.close) continue;
		for (let open = index - 1; open >= 0; open -= 1) {
			const opener = events[open][1];
			if (events[open][0] !== "exit" || opener.type !== "markSequenceTemporary" || !sides.get(opener)?.open) continue;
			opener.type = "markSequence";
			closer.type = "markSequence";
			const mark = {
				type: "mark",
				start: { ...opener.start },
				end: { ...closer.end }
			};
			const text = {
				type: "markText",
				start: { ...opener.end },
				end: { ...closer.start }
			};
			const next = [
				[
					"enter",
					mark,
					context
				],
				[
					"enter",
					opener,
					context
				],
				[
					"exit",
					opener,
					context
				],
				[
					"enter",
					text,
					context
				]
			];
			const insideSpan = context.parser.constructs.insideSpan.null;
			if (insideSpan) splice(next, next.length, 0, resolveAll(insideSpan, events.slice(open + 1, index), context));
			splice(next, next.length, 0, [
				[
					"exit",
					text,
					context
				],
				[
					"enter",
					closer,
					context
				],
				[
					"exit",
					closer,
					context
				],
				[
					"exit",
					mark,
					context
				]
			]);
			splice(events, open - 1, index - open + 3, next);
			index = open + next.length - 2;
			break;
		}
	}
	for (const [, token] of events) if (token.type === "markSequenceTemporary") token.type = "data";
	return events;
};
var tokenizeMark = function(effects, ok, nok) {
	const { previous, events } = this;
	let size = 0;
	const more = (code) => {
		if (code === EQUALS) {
			if (size > 1) return nok(code);
			effects.consume(code);
			size += 1;
			return more;
		}
		if (size < 2) return nok(code);
		const token = effects.exit("markSequenceTemporary");
		const before = classifyCharacter(previous);
		const after = classifyCharacter(code);
		sides.set(token, {
			open: !after || after === PUNCTUATION && Boolean(before),
			close: !before || before === PUNCTUATION && Boolean(after)
		});
		return ok(code);
	};
	return (code) => {
		if (previous === EQUALS && events.at(-1)?.[1].type !== "characterEscape") return nok(code);
		effects.enter("markSequenceTemporary");
		return more(code);
	};
};
function markFromMarkdown() {
	return {
		canContainEols: ["mark"],
		enter: { mark(token) {
			this.enter({
				type: "mark",
				children: []
			}, token);
		} },
		exit: { mark(token) {
			this.exit(token);
		} }
	};
}
/**
* Turn `==text==` into `mark` nodes. Like `**`, delimiters can wrap other inline nodes
* (`==a **b**==`) but not cross block boundaries.
*/
var remarkMark = function() {
	const data = this.data();
	(data.micromarkExtensions ??= []).push(markSyntax());
	(data.fromMarkdownExtensions ??= []).push(markFromMarkdown());
};
// src/plugins.ts
function visitParents(node, fn) {
	if (!("children" in node)) return;
	for (const child of node.children) visitParents(child, fn);
	fn(node);
}
/** Replace `[text][ref]` and `![alt][ref]` with plain links and images, and drop definitions. */
function remarkResolveReferences() {
	return (tree) => {
		const definitions = /* @__PURE__ */ new Map();
		visitParents(tree, (parent) => {
			for (const child of parent.children) if (child.type === "definition") definitions.set(child.identifier, child);
		});
		visitParents(tree, (parent) => {
			parent.children = parent.children.flatMap((child) => {
				if (child.type === "linkReference") {
					const def = definitions.get(child.identifier);
					return def ? [{
						type: "link",
						url: def.url,
						title: def.title,
						children: child.children
					}] : child.children;
				}
				if (child.type === "imageReference") {
					const def = definitions.get(child.identifier);
					return def ? [{
						type: "image",
						url: def.url,
						title: def.title,
						alt: child.alt
					}] : [{
						type: "text",
						value: child.alt ?? ""
					}];
				}
				return [child];
			});
		});
	};
}
// src/pipeline.ts
var BOM = "﻿";
/**
* GFM depends on the most third-party code, and old browsers reject syntax it may use, like
* regex lookbehind before Safari 16.4. A map without GFM is better than no map at all.
*/
function parseMdast(markdown, plugins, gfm = true) {
	const processor = unified().use(remarkParse).use(gfm ? [remarkGfm] : []).use(remarkFrontmatter, ["yaml"]).use(remarkHtmlImages).use(remarkMark).use(remarkResolveReferences).use(plugins);
	try {
		const tree = processor.parse(markdown);
		if (markdown.startsWith(BOM)) shiftOffsets(tree);
		const mdast = processor.runSync(tree);
		if (!isRoot(mdast)) throw new SyntaxError("The parser did not return a root");
		return {
			mdast,
			gfm
		};
	} catch (error) {
		if (!gfm || !(error instanceof SyntaxError)) throw error;
		return parseMdast(markdown, plugins, false);
	}
}
function shiftOffsets(value) {
	if (Array.isArray(value)) {
		for (const child of value) shiftOffsets(child);
		return;
	}
	if (!isRecord(value)) return;
	shiftPosition(value.position);
	for (const [key, child] of Object.entries(value)) if (key !== "position") shiftOffsets(child);
}
function shiftPosition(position) {
	if (!isRecord(position)) return;
	shiftPoint(position.start);
	shiftPoint(position.end);
}
function shiftPoint(point) {
	if (!isRecord(point)) return;
	if (typeof point.offset === "number") point.offset += 1;
	if (point.line === 1 && typeof point.column === "number") point.column += 1;
}
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
function isRoot(value) {
	if (typeof value !== "object" || value === null) return false;
	if (!("type" in value) || value.type !== "root") return false;
	return "children" in value;
}
// src/to-tree.ts
/**
* Convert an mdast tree into a Markmap tree.
*
* - Headings nest by depth; list items nest under the heading or item that contains them.
* - Other blocks become notes of the node that owns them. Blocks before the first
*   heading attach to the root.
* - A lone top-level heading at any level becomes the root. A `title` supplies
*   the root label only when no heading promotion happens.
* - Raw HTML, frontmatter and link definitions are dropped. A `<!-- markmap: … -->`
*   comment in a label sets node options: `fold` folds the node, `foldAll` folds it
*   and everything below.
*/
function toTree(mdast, options = {}) {
	const docEnd = mdast.position?.end.offset ?? 0;
	const sectionEnds = readSectionEnds(mdast.children, docEnd);
	let root = createNode("root", options.title ? [{
		type: "text",
		value: options.title
	}] : []);
	const stack = [{
		depth: 0,
		node: root
	}];
	for (const block of mdast.children) if (block.type === "heading") {
		while (stack.length > 1 && stack.at(-1).depth >= block.depth) stack.pop();
		const node = createNode("heading", block.children, block, sectionEnds.get(block));
		node.data.depth = block.depth;
		stack.at(-1).node.children.push(node);
		stack.push({
			depth: block.depth,
			node
		});
	} else addBlock(stack.at(-1).node, block, options);
	root = promoteSingleHeading(root);
	return assignIds(root);
}
function readSectionEnds(children, docEnd) {
	const ends = /* @__PURE__ */ new Map();
	const open = [];
	for (const block of children) {
		if (block.type !== "heading") continue;
		while (open.length && open[open.length - 1].depth >= block.depth) {
			const closed = open.pop();
			ends.set(closed.node, block.position?.start.offset ?? docEnd);
		}
		open.push({
			depth: block.depth,
			node: block
		});
	}
	for (const item of open) ends.set(item.node, docEnd);
	return ends;
}
function createNode(type, label, source, blockEnd) {
	const { content, directives } = readLabel(label);
	const node = {
		id: "",
		type,
		content,
		notes: [],
		data: {},
		children: []
	};
	if (directives.has("fold")) node.data.fold = true;
	if (directives.has("foldAll")) node.data.foldAll = true;
	const start = source?.position?.start.offset;
	const end = source?.position?.end.offset;
	if (start != null && end != null) {
		const range = {
			start,
			end
		};
		const info = { block: {
			start,
			end: blockEnd ?? end
		} };
		const labelRange = inlineRange(label);
		if (labelRange) info.label = labelRange;
		node.position = range;
		node.source = info;
	}
	return node;
}
function inlineRange(label) {
	const first = label.find((node) => node.type !== "html" && node.position);
	const last = label.findLast((node) => node.type !== "html" && node.position);
	if (!first?.position || !last?.position) return void 0;
	const startOffset = first.position.start.offset;
	const endOffset = last.position.end.offset;
	if (startOffset == null || endOffset == null) return void 0;
	let start = startOffset;
	let end = endOffset;
	if (first.type === "text") start += first.value.length - first.value.trimStart().length;
	if (last.type === "text") end -= last.value.length - last.value.trimEnd().length;
	return start <= end ? {
		start,
		end
	} : void 0;
}
function addBlock(parent, block, options) {
	if (isNoteFence(block)) {
		addFence(parent, block, options);
		return;
	}
	switch (block.type) {
		case "list":
			addList(parent, block, options);
			return;
		case "html":
		case "yaml":
		case "definition": return;
		default: if (isMdastBlock(block)) attach(parent, block, rangeOf(block), false);
	}
}
function isNoteFence(block) {
	return block.type === "code" && block.lang?.trim() === "markmap-note";
}
function addFence(parent, fence, options) {
	const source = rangeOf(fence);
	const { mdast } = parseMdast(fence.value, options.plugins ?? []);
	for (const block of mdast.children) {
		if (block.type === "yaml") continue;
		if (isMdastBlock(block)) attach(parent, block, source, true);
	}
}
function addList(parent, list, options) {
	for (const item of list.children) parent.children.push(fromListItem(item, list, options));
}
function fromListItem(item, list, options) {
	const [first, ...rest] = item.children;
	const hasLabel = first?.type === "paragraph" || first?.type === "heading";
	const node = createNode("listItem", hasLabel ? first.children : [], item, item.position?.end.offset);
	if (list.ordered) node.data.ordered = true;
	if (item.checked != null) node.data.checked = item.checked;
	for (const block of hasLabel ? rest : item.children) addBlock(node, block, options);
	return node;
}
function attach(node, block, source, fence) {
	const note = {
		block: stripPositions(block),
		after: node.children.length,
		fence
	};
	if (source) note.source = source;
	node.notes.push(note);
}
function rangeOf(node) {
	const start = node.position?.start.offset;
	const end = node.position?.end.offset;
	return start == null || end == null ? void 0 : {
		start,
		end
	};
}
function isMdastBlock(block) {
	switch (block.type) {
		case "blockquote":
		case "code":
		case "definition":
		case "footnoteDefinition":
		case "heading":
		case "html":
		case "list":
		case "paragraph":
		case "table":
		case "thematicBreak": return true;
		default: return false;
	}
}
function promoteSingleHeading(root) {
	const [only] = root.children;
	if (root.children.length !== 1 || only.type !== "heading") return root;
	const depth = typeof only.data.depth === "number" ? only.data.depth : 0;
	if (depth < 1 || depth > 6) return root;
	only.notes = [...root.notes.map((a) => ({
		...a,
		after: 0
	})), ...only.notes];
	return only;
}
/** Drop mdast `position` fields so the tree stays small and serializable. */
function stripPositions(value) {
	if (Array.isArray(value)) return value.map(stripPositions);
	if (value && typeof value === "object") {
		const result = {};
		for (const [key, child] of Object.entries(value)) if (key !== "position") result[key] = stripPositions(child);
		return result;
	}
	return value;
}
var DIRECTIVE = /^<!--\s*markmap:\s*([\s\S]*?)\s*-->$/;
/** Drop raw HTML from a label, collecting `<!-- markmap: … -->` directives on the way. */
function readLabel(label) {
	const directives = /* @__PURE__ */ new Set();
	const clean = (nodes) => nodes.flatMap((node) => {
		if (node.type === "html") {
			const match = node.value.trim().match(DIRECTIVE);
			for (const word of match?.[1].split(/\s+/) ?? []) if (word) directives.add(word);
			return [];
		}
		if ("children" in node) return [{
			...node,
			children: clean(node.children)
		}];
		return [node];
	});
	const content = stripPositions(clean(label));
	const last = content.at(-1);
	if (last?.type === "text") {
		last.value = last.value.trimEnd();
		if (!last.value) content.pop();
	}
	return {
		content,
		directives
	};
}
// src/parse.ts
function parse(markdown, options = {}) {
	const { mdast, gfm } = parseMdast(markdown, options.plugins ?? []);
	const frontmatter = readFrontmatter(mdast);
	const title = typeof frontmatter.title === "string" ? frontmatter.title : void 0;
	return {
		root: toTree(mdast, {
			title,
			plugins: options.plugins
		}),
		frontmatter,
		gfm,
		hasTitle: Boolean(title),
		bodyStart: readBodyStart(markdown, mdast)
	};
}
function readBodyStart(markdown, mdast) {
	let start = markdown.startsWith("﻿") ? 1 : 0;
	const frontmatter = mdast.children.find((child) => child.type === "yaml");
	if (frontmatter) {
		start = frontmatter.position?.end.offset ?? start;
		if (markdown.startsWith("\r\n", start)) start += 2;
		else if (markdown[start] === "\n") start += 1;
	}
	const offset = Math.max(0, Math.min(start, markdown.length));
	return markdown.slice(offset).trim() ? offset : markdown.length;
}
function readFrontmatter(mdast) {
	const node = mdast.children.find((child) => child.type === "yaml");
	if (!node) return {};
	try {
		const data = parse$1(node.value);
		return data && typeof data === "object" && !Array.isArray(data) ? data : {};
	} catch {
		return {};
	}
}
export { markFromMarkdown, markSyntax, parse, parseHtmlImage, remarkHtmlImages, remarkMark, remarkResolveReferences, toTree };
