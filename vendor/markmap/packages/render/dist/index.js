import { expandRect, hashString, isSafeCSSValue, multiply, oppositeSide, readJSONOptions, resolveLabelStyle, scaleAround, translate, unionRects, unknownOptionWarnings, validateOptions, validators } from "@markmap/core";
import { flextree } from "d3-flextree";
// src/content.ts
var SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/|\.{1,2}\/|[^:/?#]*(?:[/?#]|$))/i;
/** Keep http(s), mailto, tel and relative URLs. Anything else, such as `javascript:`, is dropped. */
function sanitizeUrl(url) {
	const trimmed = url.trim();
	return SAFE_URL.test(trimmed) ? trimmed : void 0;
}
/** Bold, italic, inline code, links, strikethrough, highlight and task checkboxes. */
var basicContent = {
	name: "basic",
	transform(content, node) {
		const { checked } = node.data;
		if (typeof checked !== "boolean") return content;
		return [{
			type: "checkbox",
			checked
		}, ...content];
	},
	styles: {
		strong: () => ({ font: { weight: 700 } }),
		emphasis: () => ({ font: { style: "italic" } }),
		delete: (_inline, style) => ({ decoration: { strike: style.fill } }),
		mark: () => ({ decoration: {
			background: "var(--mm-mark-bg)",
			radius: 2
		} }),
		inlineCode: (_inline, style, ctx) => ({
			font: {
				family: ctx.theme.codeFontFamily,
				size: style.font.size * .875,
				weight: 400,
				style: "normal"
			},
			fill: "var(--mm-code-text)",
			decoration: {
				background: "var(--mm-code-bg)",
				radius: 3,
				padding: style.font.size * .2
			}
		}),
		link: (inline) => {
			const href = sanitizeUrl(inline.url);
			return {
				fill: "var(--mm-link)",
				decoration: href ? { href } : void 0
			};
		}
	},
	atoms: { checkbox: {
		measure(_inline, style) {
			const size = Math.round(style.font.size * .8);
			return {
				width: size + style.font.size * .35,
				height: size,
				baseline: size
			};
		},
		render(inline, box, style) {
			const size = box.height;
			const stroke = Math.max(1, style.font.size / 12);
			const frame = {
				kind: "rect",
				x: box.x + stroke / 2,
				y: box.y + stroke / 2,
				w: size - stroke,
				h: size - stroke,
				r: size * .2,
				stroke: "var(--mm-checkbox)",
				strokeWidth: stroke,
				fill: inline.checked ? "var(--mm-checkbox)" : "none"
			};
			if (!inline.checked) return [frame];
			const [x, y] = [box.x, box.y];
			return [frame, {
				kind: "path",
				d: `M${x + size * .25},${y + size * .52}L${x + size * .43},${y + size * .7}L${x + size * .76},${y + size * .32}`,
				stroke: "var(--mm-bg)",
				strokeWidth: stroke * 1.5
			}];
		}
	} }
};
/**
* Adds a dot after the label of nodes with notes, with a hit area that asks the
* view to open them. The dot is exported; the hit area is interactive-only.
*/
var noteContent = {
	name: "notes",
	transform(content, node) {
		const count = node.notes.length;
		if (!count) return content;
		return [...content, {
			type: "noteMarker",
			count
		}];
	},
	atoms: { noteMarker: {
		measure(_inline, style) {
			const dot = Math.round(style.font.size * .4);
			return {
				width: style.font.size * .35 + dot,
				height: dot,
				baseline: dot / 2 + style.font.size * .27
			};
		},
		render(_inline, box) {
			const dot = box.height;
			const x = box.x + box.width - dot;
			const hit = Math.max(16, dot * 2.5);
			return [{
				kind: "rect",
				x,
				y: box.y,
				w: dot,
				h: dot,
				r: dot / 2,
				fill: "var(--mm-note-dot)"
			}, {
				kind: "hit",
				action: "notes",
				rect: {
					x: x + dot / 2 - hit / 2,
					y: box.y + dot / 2 - hit / 2,
					width: hit,
					height: hit
				}
			}];
		}
	} }
};
// src/image.ts
/** Layout size while the real one is unknown. */
var PLACEHOLDER = {
	width: 40,
	height: 30
};
var DEFAULT_MAX_WIDTH = 320;
var DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;
/** Like {@link sanitizeUrl}, plus base64 raster `data:` images. */
function sanitizeImageUrl(url) {
	const trimmed = url.trim();
	return DATA_IMAGE.test(trimmed) ? trimmed : sanitizeUrl(trimmed);
}
function browserLoader() {
	if (typeof Image === "undefined") return void 0;
	return (src) => new Promise((resolve, reject) => {
		const img = new Image();
		img.addEventListener("load", () => resolve({
			width: img.naturalWidth,
			height: img.naturalHeight
		}));
		img.addEventListener("error", () => reject(/* @__PURE__ */ new Error(`Could not load ${src}`)));
		img.src = src;
	});
}
/** Size from the given dimensions and, when known, the natural size; `undefined` if unknowable yet. */
function fit(given, natural) {
	const { width, height } = given;
	if (width && height) return {
		width,
		height
	};
	if (!natural?.width || !natural.height) return void 0;
	const ratio = natural.width / natural.height;
	if (width) return {
		width,
		height: width / ratio
	};
	if (height) return {
		width: height * ratio,
		height
	};
	return natural;
}
/** A guess that keeps any given dimension, used until the natural size is known. */
var guess = ({ width, height }) => width || height ? {
	width: width ?? height,
	height: height ?? width
} : PLACEHOLDER;
/** Size of an image's alt text, drawn in place of the image. */
function altSize(alt, style, ctx) {
	const { font } = style;
	return {
		width: ctx.measurer.measure(alt, font),
		height: font.lineHeight,
		baseline: (font.lineHeight + font.size * .7) / 2
	};
}
function altText(alt, box, style, ctx) {
	if (!alt) return [];
	const { baseline } = altSize(alt, style, ctx);
	const run = {
		text: alt,
		x: 0,
		y: baseline,
		font: style.font,
		fill: style.fill
	};
	return [{
		kind: "text",
		x: box.x,
		y: box.y,
		runs: [run]
	}];
}
/**
* Draws Markdown images and sized `<img>` tags inside labels. Sizes come from the tag,
* from a cache of loaded sizes, or from a placeholder while the image loads; the view
* then renders again (see `InlineContext.defer`). Images are capped at the label wrap
* width, keeping their aspect ratio. Images that fail to load show their alt text.
*/
function createImageContent(options = {}) {
	const loadSize = options.loadSize ?? browserLoader();
	const allow = options.allow ?? (() => true);
	/** Natural sizes; `null` when loading failed. */
	const sizes = /* @__PURE__ */ new Map();
	const loading = /* @__PURE__ */ new Map();
	const load = (src, ctx) => {
		if (!loadSize || sizes.has(src)) return;
		let task = loading.get(src);
		if (!task) {
			task = loadSize(src).then((size) => sizes.set(src, size), () => sizes.set(src, null)).finally(() => loading.delete(src));
			loading.set(src, task);
		}
		ctx.defer?.(task);
	};
	/** Size of the image as drawn, or `undefined` to show its alt text. */
	const imageSize = (inline, ctx) => {
		const src = sanitizeImageUrl(inline.url);
		if (!src || !allow(src)) return void 0;
		const given = inline.data ?? {};
		const natural = sizes.get(src);
		let size = fit(given, natural ?? void 0);
		if (!size) {
			if (natural === null) return void 0;
			load(src, ctx);
			size = guess(given);
		}
		const max = ctx.wrapWidth && ctx.wrapWidth > 0 ? ctx.wrapWidth : options.maxWidth ?? DEFAULT_MAX_WIDTH;
		return size.width > max ? {
			width: max,
			height: size.height * max / size.width
		} : size;
	};
	return {
		name: "images",
		atoms: { image: {
			measure(inline, style, ctx) {
				const size = imageSize(inline, ctx);
				return size ? {
					...size,
					baseline: size.height
				} : altSize(inline.alt ?? "", style, ctx);
			},
			render(inline, box, style, ctx) {
				const src = imageSize(inline, ctx) && sanitizeImageUrl(inline.url);
				const alt = altText(inline.alt, box, style, ctx);
				if (!src) return alt;
				const { x, y, width: w, height: h } = box;
				const image = {
					kind: "image",
					x,
					y,
					w,
					h,
					src
				};
				if (alt.length) image.fallback = [{
					kind: "group",
					clip: box,
					children: alt
				}];
				return [image];
			}
		} }
	};
}
/** Images with sizes loaded in the browser. */
var imageContent = createImageContent();
// src/default-plugins.ts
/** Plugins used when none are given: basic styles, images, and note dots. */
var defaultContentPlugins = [
	basicContent,
	imageContent,
	noteContent
];
// src/layouts/tree.ts
/** Return the subtree that is visible when the `folded` nodes are collapsed. */
function visibleNodes(root, folded) {
	const result = [];
	const visit = (node) => {
		result.push(node);
		if (!folded?.has(node.id)) node.children.forEach(visit);
	};
	visit(root);
	return result;
}
/** Tidy tree layout, root on the left, growing to the right. */
function layoutTree(root, options) {
	const { sizes, folded, levelGap = 80, siblingGap = 5 } = options;
	const sizeOf = (node) => {
		const size = sizes.get(node.id);
		if (!size) throw new Error(`Missing size for node ${node.id}`);
		return size;
	};
	const layout = flextree({
		children: (node) => folded?.has(node.id) ? void 0 : node.children,
		nodeSize: (h) => {
			const { width, height } = sizeOf(h.data);
			return [height, width + levelGap];
		},
		spacing: (a, b) => a.parent === b.parent ? siblingGap : siblingGap * 2
	});
	const tree = layout.hierarchy(root);
	layout(tree);
	const nodes = [];
	const byId = /* @__PURE__ */ new Map();
	const convert = (h, parent) => {
		const { width, height } = sizeOf(h.data);
		const item = {
			node: h.data,
			parent,
			children: [],
			depth: h.depth,
			folded: !!folded?.has(h.data.id) && h.data.children.length > 0,
			rect: {
				x: h.y,
				y: h.x - height / 2,
				width,
				height
			},
			direction: "right"
		};
		nodes.push(item);
		byId.set(item.node.id, item);
		for (const child of h.children ?? []) item.children.push(convert(child, item));
		return item;
	};
	convert(tree);
	return {
		nodes,
		byId,
		bounds: unionRects(nodes.map((n) => n.rect))
	};
}
/** The classic markmap layout: a tidy tree growing to the right. */
var treeLayout = {
	name: "tree",
	layout: layoutTree
};
// src/layouts/two-sided.ts
/** Leaves under a node, ignoring folds, so folding never moves a branch to the other side. */
function leafCount(node) {
	return node.children.length ? node.children.reduce((sum, c) => sum + leafCount(c), 0) : 1;
}
/**
* How many of the root's first children go on the right; the rest go on the left. Splits
* the list where the two sides' leaf counts are closest, keeping document order on both
* sides and favoring the right on a tie.
*/
function splitBranches(children) {
	const weights = children.map(leafCount);
	const total = weights.reduce((a, b) => a + b, 0);
	let best = children.length;
	let bestDiff = Infinity;
	let right = 0;
	for (let k = 1; k <= children.length; k++) {
		right += weights[k - 1];
		const diff = Math.abs(right - (total - right));
		if (diff <= bestDiff) {
			best = k;
			bestDiff = diff;
		}
	}
	return best;
}
/**
* A mind map: the root in the middle, its first branches growing to the right and the
* rest to the left, balanced by size. Both sides keep document order top to bottom.
*/
function layoutTwoSided(root, options) {
	if (options.folded?.has(root.id) || root.children.length < 2) return layoutTree(root, options);
	const split = splitBranches(root.children);
	const side = (children) => layoutTree({
		...root,
		children
	}, options);
	const right = side(root.children.slice(0, split));
	const left = side(root.children.slice(split));
	const rootRect = right.nodes[0].rect;
	const place = /* @__PURE__ */ new Map();
	for (const item of right.nodes) place.set(item.node.id, {
		rect: item.rect,
		direction: "right"
	});
	for (const item of left.nodes.slice(1)) {
		const { rect } = item;
		const x = rootRect.x * 2 + rootRect.width - rect.x - rect.width;
		place.set(item.node.id, {
			rect: {
				...rect,
				x
			},
			direction: "left"
		});
	}
	const nodes = [];
	const byId = /* @__PURE__ */ new Map();
	const visit = (node, depth, parent) => {
		const { rect, direction } = place.get(node.id);
		const folded = !!options.folded?.has(node.id) && node.children.length > 0;
		const item = {
			node,
			parent,
			children: [],
			depth,
			folded,
			rect,
			direction
		};
		nodes.push(item);
		byId.set(node.id, item);
		if (!folded) for (const child of node.children) item.children.push(visit(child, depth + 1, item));
		return item;
	};
	visit(root, 0);
	return {
		nodes,
		byId,
		bounds: unionRects(nodes.map((n) => n.rect))
	};
}
/** Root in the middle, branches on both sides. */
var twoSidedLayout = {
	name: "two-sided",
	layout: layoutTwoSided
};
// src/layouts/org-chart.ts
/**
* Siblings sit side by side here, and labels need more room across than above each
* other, so the sibling gap is this many times `siblingGap`.
*/
var SIBLING_GAP_FACTOR = 3;
/**
* Top-down tidy tree: the root at the top, children in a row below their parent.
* `levelGap` is the gap between levels; siblings are `siblingGap × 3`
* apart, doubled between cousins.
*/
function layoutOrgChart(root, options) {
	const { sizes, folded, levelGap = 80, siblingGap = 5 } = options;
	const scaledGap = siblingGap * SIBLING_GAP_FACTOR;
	const sizeOf = (node) => {
		const size = sizes.get(node.id);
		if (!size) throw new Error(`Missing size for node ${node.id}`);
		return size;
	};
	const layout = flextree({
		children: (node) => folded?.has(node.id) ? void 0 : node.children,
		nodeSize: (h) => {
			const { width, height } = sizeOf(h.data);
			return [width, height + levelGap];
		},
		spacing: (a, b) => a.parent === b.parent ? scaledGap : scaledGap * 2
	});
	const tree = layout.hierarchy(root);
	layout(tree);
	const nodes = [];
	const byId = /* @__PURE__ */ new Map();
	const convert = (h, parent) => {
		const { width, height } = sizeOf(h.data);
		const item = {
			node: h.data,
			parent,
			children: [],
			depth: h.depth,
			folded: !!folded?.has(h.data.id) && h.data.children.length > 0,
			rect: {
				x: h.x - width / 2,
				y: h.y,
				width,
				height
			},
			direction: "bottom"
		};
		nodes.push(item);
		byId.set(item.node.id, item);
		for (const child of h.children ?? []) item.children.push(convert(child, item));
		return item;
	};
	convert(tree);
	return {
		nodes,
		byId,
		bounds: unionRects(nodes.map((n) => n.rect))
	};
}
/** Org chart: root at the top, growing downwards. */
var orgChartLayout = {
	name: "org-chart",
	layout: layoutOrgChart
};
// src/measure.ts
function fontToCss(font) {
	return `${font.style} ${font.weight} ${font.size}px ${font.family}`;
}
var ASCII_WIDTHS = [
	278,
	278,
	355,
	556,
	556,
	889,
	667,
	191,
	333,
	333,
	389,
	584,
	278,
	333,
	278,
	278,
	556,
	556,
	556,
	556,
	556,
	556,
	556,
	556,
	556,
	556,
	278,
	278,
	584,
	584,
	584,
	556,
	1015,
	667,
	667,
	722,
	722,
	667,
	611,
	778,
	722,
	278,
	500,
	667,
	556,
	833,
	722,
	778,
	667,
	778,
	722,
	667,
	611,
	722,
	667,
	944,
	667,
	667,
	611,
	278,
	278,
	278,
	469,
	556,
	333,
	556,
	556,
	500,
	556,
	556,
	278,
	556,
	556,
	222,
	222,
	500,
	222,
	833,
	556,
	556,
	556,
	556,
	333,
	500,
	278,
	556,
	500,
	722,
	500,
	500,
	500,
	334,
	260,
	334,
	584
];
/** East Asian wide characters, fullwidth forms and emoji take a full em. */
var WIDE = /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6\p{Extended_Pictographic}]/u;
/** Combining marks, variation selectors and format characters such as ZWJ. */
var ZERO_WIDTH = /^[\p{Mn}\p{Me}\p{Cf}]$/u;
/**
* Approximates widths from Helvetica metrics, without a font or canvas. Good enough
* for Node rendering and tests; use {@link createCanvasMeasurer} in the browser.
*/
var approximateMeasurer = { measure(text, font) {
	const mono = /mono|consolas|courier|menlo/i.test(font.family);
	let em = 0;
	for (const char of text) {
		const code = char.codePointAt(0);
		if (code >= 32 && code <= 126) em += mono ? .6 : ASCII_WIDTHS[code - 32] / 1e3;
		else if (ZERO_WIDTH.test(char)) continue;
		else if (WIDE.test(char)) em += 1;
		else em += .6;
	}
	return em * font.size * (font.weight >= 600 ? 1.06 : 1);
} };
/** Measures with a canvas 2D context, caching results per font and text. */
function createCanvasMeasurer(ctx) {
	const context = ctx ?? createContext();
	const cache = /* @__PURE__ */ new Map();
	return { measure(text, font) {
		const css = fontToCss(font);
		const key = `${css}\n${text}`;
		let width = cache.get(key);
		if (width == null) {
			if (context.font !== css) context.font = css;
			width = context.measureText(text).width;
			cache.set(key, width);
		}
		return width;
	} };
}
function createContext() {
	const context = (typeof OffscreenCanvas === "undefined" ? document.createElement("canvas") : new OffscreenCanvas(1, 1)).getContext("2d");
	if (!context) throw new Error("Canvas 2D is not available");
	return context;
}
// src/themes/branch.ts
/**
* Pick a color index for a node from its path of ids, for themes that color by branch.
* The node's id is hashed, so colors stay put as the tree changes. With `colorDepth`
* (the root is level 1), nodes deeper than that level use their ancestor's id instead.
*/
function branchIndex(path, count, colorDepth = 0) {
	const id = colorDepth > 0 && path.length > colorDepth ? path[colorDepth - 1] : path.at(-1);
	return Number.parseInt(hashString(id), 36) % Math.max(1, count);
}
/** The d3 category10 palette, used by the built-in themes. */
var DEFAULT_COLORS = [
	"#1f77b4",
	"#ff7f0e",
	"#2ca02c",
	"#d62728",
	"#9467bd",
	"#8c564b",
	"#e377c2",
	"#7f7f7f",
	"#bcbd22",
	"#17becf"
];
/** Branch color tokens and a lookup from a node's path to its `var(--mm-branch-N)`. */
function branchColors(options) {
	const colors = options.color?.length ? options.color : DEFAULT_COLORS;
	const colorDepth = options.colorDepth ?? 0;
	return {
		tokens: Object.fromEntries(colors.map((color, i) => [`mm-branch-${i}`, color])),
		colorOf: (path) => `var(--mm-branch-${branchIndex(path, colors.length, colorDepth)})`
	};
}
// src/themes/shared.ts
/** Tokens for inline content, shared by the built-in themes. */
var CONTENT_TOKENS = {
	"mm-link": "#0097e6",
	"mm-code-bg": "#f0f0f0",
	"mm-code-text": "#555",
	"mm-mark-bg": "#ffeaa7",
	"mm-checkbox": "#555",
	"mm-note-dot": "#999",
	"mm-group-border": "rgba(0, 122, 255, 0.45)",
	"mm-group-fill": "rgba(0, 122, 255, 0.08)",
	"mm-syntax-keyword": "#cf222e",
	"mm-syntax-string": "#0a3069",
	"mm-syntax-comment": "#6e7781",
	"mm-syntax-number": "#0550ae",
	"mm-syntax-title": "#8250df",
	"mm-syntax-attr": "#116329",
	"mm-edge-relation": "#8c959f",
	"mm-edge-relation-label": "#57606a"
};
var DARK_CONTENT_TOKENS = {
	"mm-link": "#4fb3f6",
	"mm-code-bg": "#2f2f33",
	"mm-code-text": "#d4d4d4",
	"mm-mark-bg": "#6b5a1e",
	"mm-checkbox": "#bbb",
	"mm-note-dot": "#888",
	"mm-group-border": "rgba(88, 166, 255, 0.45)",
	"mm-group-fill": "rgba(88, 166, 255, 0.12)",
	"mm-syntax-keyword": "#ff7b72",
	"mm-syntax-string": "#a5d6ff",
	"mm-syntax-comment": "#8b949e",
	"mm-syntax-number": "#79c0ff",
	"mm-syntax-title": "#d2a8ff",
	"mm-syntax-attr": "#7ee787",
	"mm-edge-relation": "#8b949e",
	"mm-edge-relation-label": "#c9d1d9"
};
var SYSTEM_FONT = {
	family: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Helvetica, Arial, sans-serif",
	size: 16,
	weight: 400,
	style: "normal",
	lineHeight: 20
};
var CODE_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** Wrapped lines hug the edge that faces the parent. */
function alignFor(direction) {
	if (direction === "left") return "end";
	if (direction === "right") return "start";
	return "center";
}
/** An S-curve that leaves and arrives along the anchors' axis. */
function sCurve(from, to) {
	const vertical = from.side === "top" || from.side === "bottom";
	const mx = (from.x + to.x) / 2;
	const my = (from.y + to.y) / 2;
	const controls = vertical ? `${from.x},${my},${to.x},${my}` : `${mx},${from.y},${mx},${to.y}`;
	return `M${from.x},${from.y}C${controls},${to.x},${to.y}`;
}
/** The middle of one side of a box at (0, 0), pushed `gap` px outwards. */
function sidePoint(width, height, side, gap = 0) {
	if (side === "left") return {
		x: -gap,
		y: height / 2
	};
	if (side === "right") return {
		x: width + gap,
		y: height / 2
	};
	if (side === "top") return {
		x: width / 2,
		y: -gap
	};
	return {
		x: width / 2,
		y: height + gap
	};
}
// src/themes/cards.ts
var RADIUS = 8;
var TOGGLE_RADIUS$1 = 5;
/** Each node in a rounded card outlined in its branch color. */
function createCardsTheme(options = {}) {
	const { tokens: branchTokens, colorOf } = branchColors(options);
	return {
		name: "cards",
		options: {
			color: validators.colors(),
			colorDepth: validators.number(0, true)
		},
		configure: (next) => createCardsTheme({
			...options,
			...next
		}),
		tokens: {
			"mm-text": "#222",
			"mm-bg": "#f6f7f9",
			"mm-card-bg": "#fff",
			...CONTENT_TOKENS,
			...branchTokens
		},
		darkTokens: {
			"mm-text": "#e6e6e6",
			"mm-bg": "#17181b",
			"mm-card-bg": "#25262b",
			...DARK_CONTENT_TOKENS
		},
		font: SYSTEM_FONT,
		codeFontFamily: CODE_FONT,
		textFill: "var(--mm-text)",
		node: {
			padding: [
				6,
				12,
				6,
				12
			],
			minHeight: 32,
			textAlign: (ctx) => alignFor(ctx.direction),
			presence: (presence, box) => ({
				opacity: presence,
				transform: scaleAround(.6 + .4 * presence, box.width / 2, box.height / 2)
			}),
			render(_node, box, ctx) {
				const color = colorOf(ctx.path);
				const card = {
					kind: "rect",
					x: 0,
					y: 0,
					w: box.width,
					h: box.height,
					r: RADIUS,
					fill: "var(--mm-card-bg)",
					stroke: color,
					strokeWidth: ctx.depth === 0 ? 2.5 : 1.5
				};
				if (!ctx.hasChildren) return [card];
				const at = sidePoint(box.width, box.height, ctx.direction);
				return [card, {
					kind: "rect",
					x: at.x - TOGGLE_RADIUS$1,
					y: at.y - TOGGLE_RADIUS$1,
					w: 10,
					h: 10,
					r: TOGGLE_RADIUS$1,
					fill: ctx.folded ? color : "var(--mm-card-bg)",
					stroke: color,
					strokeWidth: 1.5
				}];
			},
			anchor(rect, side) {
				const at = sidePoint(rect.width, rect.height, side);
				return {
					x: rect.x + at.x,
					y: rect.y + at.y,
					side
				};
			}
		},
		edge: { render: (from, to, ctx) => [{
			kind: "path",
			d: sCurve(from, to),
			stroke: colorOf(ctx.node.path),
			strokeWidth: 1.5
		}] }
	};
}
var cardsTheme = createCardsTheme();
// src/themes/classic.ts
var CIRCLE_RADIUS = 6;
/** Space between a top anchor and the label below it. */
var TOP_GAP = 4;
/** Line width shrinks with depth: 4, 2.5, 1.75, … */
var lineWidth = (depth) => 1 + 3 / 2 ** depth;
/** The original markmap look: underlined labels, curved edges and fold circles. */
function createClassicTheme(options = {}) {
	const { tokens: branchTokens, colorOf } = branchColors(options);
	return {
		name: "classic",
		options: {
			color: validators.colors(),
			colorDepth: validators.number(0, true)
		},
		configure: (next) => createClassicTheme({
			...options,
			...next
		}),
		tokens: {
			"mm-text": "#333",
			"mm-bg": "#fff",
			"mm-toggle-bg": "#fff",
			...CONTENT_TOKENS,
			...branchTokens
		},
		darkTokens: {
			"mm-text": "#ddd",
			"mm-bg": "#1e1e1e",
			"mm-toggle-bg": "#1e1e1e",
			...DARK_CONTENT_TOKENS
		},
		font: SYSTEM_FONT,
		codeFontFamily: CODE_FONT,
		textFill: "var(--mm-text)",
		node: {
			padding: [
				0,
				8,
				0,
				8
			],
			minHeight: 16,
			textAlign: (ctx) => alignFor(ctx.direction),
			render(_node, box, ctx) {
				const color = colorOf(ctx.path);
				const width = lineWidth(ctx.depth);
				const y = box.height + width / 2;
				const cx = {
					left: 0,
					right: box.width,
					top: box.width / 2,
					bottom: box.width / 2
				}[ctx.direction];
				const chrome = [{
					kind: "path",
					d: `M0,${y}H${box.width}`,
					stroke: color,
					strokeWidth: width
				}];
				if (!ctx.hasChildren) return chrome;
				return [...chrome, {
					kind: "rect",
					x: cx - CIRCLE_RADIUS,
					y: y - CIRCLE_RADIUS,
					w: 12,
					h: 12,
					r: CIRCLE_RADIUS,
					fill: ctx.folded ? color : "var(--mm-toggle-bg)",
					stroke: color,
					strokeWidth: 1.5
				}];
			},
			anchor(rect, side, ctx) {
				const y = rect.y + rect.height + lineWidth(ctx.depth) / 2;
				if (side === "left") return {
					x: rect.x,
					y,
					side
				};
				if (side === "right") return {
					x: rect.x + rect.width,
					y,
					side
				};
				return {
					x: rect.x + rect.width / 2,
					y: side === "top" ? rect.y - TOP_GAP : y,
					side
				};
			}
		},
		edge: { render: (from, to, ctx) => [{
			kind: "path",
			d: sCurve(from, to),
			stroke: colorOf(ctx.node.path),
			strokeWidth: lineWidth(ctx.node.depth)
		}] }
	};
}
var classicTheme = createClassicTheme();
// src/themes/minimal.ts
/** Space between a label and where its edges start. */
var GAP = 6;
var DOT_RADIUS = 3.5;
/** Plain text joined by thin gray lines; a small dot marks nodes that fold. */
var minimalTheme = {
	name: "minimal",
	tokens: {
		"mm-text": "#333",
		"mm-bg": "#fff",
		"mm-edge": "#c4c4c4",
		...CONTENT_TOKENS
	},
	darkTokens: {
		"mm-text": "#ddd",
		"mm-bg": "#1e1e1e",
		"mm-edge": "#555",
		...DARK_CONTENT_TOKENS
	},
	font: SYSTEM_FONT,
	codeFontFamily: CODE_FONT,
	textFill: "var(--mm-text)",
	node: {
		padding: [
			2,
			4,
			2,
			4
		],
		textAlign: (ctx) => alignFor(ctx.direction),
		render(_node, box, ctx) {
			if (!ctx.hasChildren) return [];
			const at = sidePoint(box.width, box.height, ctx.direction, GAP);
			return [{
				kind: "rect",
				x: at.x - DOT_RADIUS,
				y: at.y - DOT_RADIUS,
				w: DOT_RADIUS * 2,
				h: DOT_RADIUS * 2,
				r: DOT_RADIUS,
				fill: ctx.folded ? "var(--mm-edge)" : "var(--mm-bg)",
				stroke: "var(--mm-edge)",
				strokeWidth: 1.5
			}];
		},
		anchor(rect, side) {
			const at = sidePoint(rect.width, rect.height, side, GAP);
			return {
				x: rect.x + at.x,
				y: rect.y + at.y,
				side
			};
		}
	},
	edge: { render: (from, to) => [{
		kind: "path",
		d: sCurve(from, to),
		stroke: "var(--mm-edge)",
		strokeWidth: 1
	}] }
};
// src/themes/soft.ts
var LIGHT_COLORS = [
	"#4a7fa8",
	"#5f8b4c",
	"#8a6aa8",
	"#b08434",
	"#3f8f8a",
	"#b45f6a"
];
var DARK_COLORS = [
	"#7fb2e0",
	"#9dc98a",
	"#b39ad8",
	"#dbb76c",
	"#6fc6bb",
	"#e08ba8"
];
var LIGHT_TEXT = "#2b3138";
var DARK_TEXT = "#e8edf4";
var LIGHT_BG = "#ffffff";
var DARK_BG = "#1e1e1e";
var LIGHT_TINT = "rgba(255,255,255,0.91)";
var DARK_TINT = "rgba(30,30,30,0.88)";
var LIGHT_ROOT_BG = "#344456";
var DARK_ROOT_BG = "#405267";
var ROOT_TEXT = "#ffffff";
var LIGHT_TOGGLE = "#7b8798";
var DARK_TOGGLE = "#9aa6b6";
var ROOT_FONT = {
	...SYSTEM_FONT,
	size: 20,
	weight: 600,
	lineHeight: 26
};
var TOPIC_FONT = {
	...SYSTEM_FONT,
	size: 16,
	weight: 500,
	lineHeight: 22
};
var LEAF_FONT = {
	...SYSTEM_FONT,
	size: 14,
	weight: 400,
	lineHeight: 20
};
var ROOT_PADDING = [
	14,
	18,
	14,
	18
];
var TOPIC_PADDING = [
	9,
	14,
	9,
	14
];
var LEAF_PADDING = [
	2,
	4,
	6,
	4
];
var ROOT_RADIUS = 7;
var TOPIC_RADIUS = 6;
var ROOT_EDGE_START = 5.3;
var ROOT_EDGE_END = 1.3;
var BRANCH_EDGE_WIDTH = 1.5;
var LEAF_UNDERLINE = 1.5;
var TOGGLE_RADIUS = 6;
var LEAF_BASELINE_INSET = 3;
var CHILD_EDGE_CURVE = .75;
var darkBranchTokens = Object.fromEntries(DARK_COLORS.map((color, index) => [`mm-branch-${index}`, color]));
var label = (depth) => {
	if (depth === 0) return {
		font: ROOT_FONT,
		fill: "var(--mm-soft-root-text)",
		padding: ROOT_PADDING
	};
	if (depth === 1) return {
		font: TOPIC_FONT,
		fill: "var(--mm-text)",
		padding: TOPIC_PADDING
	};
	return {
		font: LEAF_FONT,
		fill: "var(--mm-text)",
		padding: LEAF_PADDING
	};
};
var point = (x, y) => ({
	x,
	y
});
function taperedCurve(from, to, startWidth, endWidth) {
	const vertical = from.side === "top" || from.side === "bottom";
	const middleX = (from.x + to.x) / 2;
	const middleY = (from.y + to.y) / 2;
	const first = vertical ? point(from.x, middleY) : point(middleX, from.y);
	const second = vertical ? point(to.x, middleY) : point(middleX, to.y);
	const left = [];
	const right = [];
	const steps = 32;
	for (let index = 0; index <= steps; index += 1) {
		const t = index / steps;
		const u = 1 - t;
		const x = u ** 3 * from.x + 3 * u ** 2 * t * first.x + 3 * u * t ** 2 * second.x + t ** 3 * to.x;
		const y = u ** 3 * from.y + 3 * u ** 2 * t * first.y + 3 * u * t ** 2 * second.y + t ** 3 * to.y;
		const dx = 3 * u ** 2 * (first.x - from.x) + 6 * u * t * (second.x - first.x) + 3 * t ** 2 * (to.x - second.x);
		const dy = 3 * u ** 2 * (first.y - from.y) + 6 * u * t * (second.y - first.y) + 3 * t ** 2 * (to.y - second.y);
		const length = Math.hypot(dx, dy) || 1;
		const half = (startWidth + (endWidth - startWidth) * t) / 2;
		const offsetX = -dy / length * half;
		const offsetY = dx / length * half;
		left.push(`${x + offsetX},${y + offsetY}`);
		right.push(`${x - offsetX},${y - offsetY}`);
	}
	return `M${left.join("L")}L${right.reverse().join("L")}Z`;
}
function childCurve(from, to) {
	const vertical = from.side === "top" || from.side === "bottom";
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	if (vertical) return `M${from.x},${from.y}C${from.x},${from.y + dy * CHILD_EDGE_CURVE},${to.x},${to.y - dy * CHILD_EDGE_CURVE},${to.x},${to.y}`;
	return `M${from.x},${from.y}C${from.x + dx * CHILD_EDGE_CURVE},${from.y},${to.x - dx * CHILD_EDGE_CURVE},${to.y},${to.x},${to.y}`;
}
function createSoftTheme(options = {}) {
	const withDefaults = {
		color: LIGHT_COLORS,
		colorDepth: 2,
		...options
	};
	const { tokens: branchTokens } = branchColors(withDefaults);
	const colors = withDefaults.color?.length ? withDefaults.color : DEFAULT_COLORS;
	const colorOf = (path, branch) => `var(--mm-branch-${branch != null && withDefaults.colorDepth === 2 ? branch % colors.length : branchIndex(path, colors.length, withDefaults.colorDepth)})`;
	const customColors = !!options.color?.length;
	return {
		name: "soft",
		options: {
			color: validators.colors(),
			colorDepth: validators.number(0, true)
		},
		configure: (next) => createSoftTheme({
			...options,
			...next
		}),
		tokens: {
			"mm-text": LIGHT_TEXT,
			"mm-bg": LIGHT_BG,
			"mm-soft-root-bg": LIGHT_ROOT_BG,
			"mm-soft-root-text": ROOT_TEXT,
			"mm-soft-tint": LIGHT_TINT,
			"mm-soft-toggle": LIGHT_TOGGLE,
			...CONTENT_TOKENS,
			...branchTokens
		},
		darkTokens: {
			"mm-text": DARK_TEXT,
			"mm-bg": DARK_BG,
			"mm-soft-root-bg": DARK_ROOT_BG,
			"mm-soft-tint": DARK_TINT,
			"mm-soft-toggle": DARK_TOGGLE,
			...DARK_CONTENT_TOKENS,
			...customColors ? {} : darkBranchTokens
		},
		font: LEAF_FONT,
		codeFontFamily: CODE_FONT,
		textFill: "var(--mm-text)",
		label: (_node, ctx) => label(ctx.depth),
		node: {
			padding: [...LEAF_PADDING],
			textAlign: (ctx) => ctx.depth <= 1 ? "center" : alignFor(ctx.direction),
			render(node, box, ctx) {
				if (ctx.depth === 0 && node.content.length === 0) return [];
				const color = colorOf(ctx.path, ctx.branch);
				const toggle = ctx.depth === 0 ? "var(--mm-soft-toggle)" : color;
				const chrome = [];
				if (ctx.depth === 0) chrome.push({
					kind: "rect",
					x: 0,
					y: 0,
					w: box.width,
					h: box.height,
					r: ROOT_RADIUS,
					fill: "var(--mm-soft-root-bg)"
				});
				else if (ctx.depth === 1) chrome.push({
					kind: "rect",
					x: 0,
					y: 0,
					w: box.width,
					h: box.height,
					r: TOPIC_RADIUS,
					fill: color
				}, {
					kind: "rect",
					x: 0,
					y: 0,
					w: box.width,
					h: box.height,
					r: TOPIC_RADIUS,
					fill: "var(--mm-soft-tint)",
					stroke: color,
					strokeWidth: 1.2
				});
				else {
					const y = box.height - LEAF_BASELINE_INSET;
					chrome.push({
						kind: "path",
						d: `M0,${y}H${box.width}`,
						stroke: color,
						strokeWidth: LEAF_UNDERLINE
					});
				}
				if (!ctx.hasChildren) return chrome;
				const anchor = ctx.depth <= 1 ? point(ctx.direction === "left" ? 0 : ctx.direction === "right" ? box.width : box.width / 2, ctx.direction === "top" ? 0 : ctx.direction === "bottom" ? box.height : box.height / 2) : point(ctx.direction === "left" ? 0 : ctx.direction === "right" ? box.width : box.width / 2, ctx.direction === "top" ? 0 : ctx.direction === "bottom" ? box.height : box.height - LEAF_BASELINE_INSET);
				chrome.push({
					kind: "rect",
					x: anchor.x - TOGGLE_RADIUS,
					y: anchor.y - TOGGLE_RADIUS,
					w: 12,
					h: 12,
					r: TOGGLE_RADIUS,
					fill: ctx.folded ? toggle : "var(--mm-bg)",
					stroke: toggle,
					strokeWidth: 1.4
				});
				return chrome;
			},
			anchor(rect, side, ctx) {
				if (side === "left" || side === "right") {
					const y = ctx.depth <= 1 ? rect.y + rect.height / 2 : rect.y + rect.height - LEAF_BASELINE_INSET;
					return {
						x: side === "left" ? rect.x : rect.x + rect.width,
						y,
						side
					};
				}
				return {
					x: rect.x + rect.width / 2,
					y: side === "top" ? rect.y : rect.y + rect.height,
					side
				};
			}
		},
		edge: { render: (from, to, ctx) => ctx.node.depth === 1 ? [{
			kind: "path",
			d: taperedCurve(from, to, ROOT_EDGE_START, ROOT_EDGE_END),
			fill: colorOf(ctx.node.path, ctx.node.branch)
		}] : [{
			kind: "path",
			d: childCurve(from, to),
			stroke: colorOf(ctx.node.path, ctx.node.branch),
			strokeWidth: BRANCH_EDGE_WIDTH
		}] }
	};
}
var softTheme = createSoftTheme();
// src/options.ts
/** Layouts Markdown can pick by name with the `layout` option. */
var builtinLayouts = Object.freeze({
	[treeLayout.name]: treeLayout,
	[twoSidedLayout.name]: twoSidedLayout,
	[orgChartLayout.name]: orgChartLayout
});
/** Themes Markdown can pick by name with the `theme` option. */
var builtinThemes = Object.freeze({
	[classicTheme.name]: classicTheme,
	[cardsTheme.name]: cardsTheme,
	[minimalTheme.name]: minimalTheme,
	[softTheme.name]: softTheme
});
/** Look up a name from Markdown, warning when it is not registered. */
function pick(kind, name, registry, warnings) {
	if (name == null) return void 0;
	if (Object.hasOwn(registry, name)) return registry[name];
	const names = Object.keys(registry).map((key) => `\`${key}\``);
	warnings.push(`Unknown ${kind} \`${name}\`; available: ${names.join(", ")}`);
}
/**
* Apply the theme's own options (for example `color`) and return the keys it did not
* claim. Themes without options leave everything in `rest`.
*/
function configureTheme(theme, input) {
	if (!theme.options) return {
		theme,
		rest: input,
		warnings: []
	};
	const { options, rest, warnings } = validateOptions(input, theme.options);
	return {
		theme: Object.keys(options).length && theme.configure ? theme.configure(options) : theme,
		rest,
		warnings
	};
}
/** Markdown option keys that map straight onto render options. */
var RENDER_KEYS = [
	"wrapWidth",
	"levelGap",
	"siblingGap"
];
/**
* Validate untrusted Markdown options (usually `frontmatter.markmap`) and apply them on
* top of `base`: shared keys first, then the theme's own keys. Anything left is reported.
*/
function resolveRenderOptions(base, input, { layouts = builtinLayouts, themes = builtinThemes } = {}) {
	const core = readJSONOptions(input);
	const result = { ...base };
	for (const key of RENDER_KEYS) if (core.options[key] != null) result[key] = core.options[key];
	const pickWarnings = [];
	const layout = pick("layout", core.options.layout, layouts, pickWarnings);
	if (layout) result.layout = layout;
	const themed = configureTheme(pick("theme", core.options.theme, themes, pickWarnings) ?? base.theme ?? classicTheme, core.rest);
	if (themed.theme !== (base.theme ?? classicTheme)) result.theme = themed.theme;
	return {
		options: result,
		json: core.options,
		warnings: [
			...core.warnings,
			...pickWarnings,
			...themed.warnings,
			...unknownOptionWarnings(themed.rest)
		]
	};
}
// src/paint.ts
/** Nesting depth at which token references are assumed to loop. */
var MAX_DEPTH = 8;
/**
* Resolve CSS custom properties in a paint, for drawing outside CSS (canvas, PNG export).
* Every `var(--name)` and `var(--name, fallback)` is replaced by the token's value, which
* may refer to other tokens, or else by its fallback. Anything else is kept as is.
* Returns `undefined` when a variable has neither, or tokens refer to each other in a loop.
*/
function resolvePaint(paint, tokens) {
	if (paint == null) return void 0;
	return substitute(paint, typeof tokens === "function" ? tokens : (name) => tokens[name], 0);
}
function substitute(value, lookup, depth) {
	if (depth > MAX_DEPTH) return void 0;
	let out = "";
	let from = 0;
	for (;;) {
		const start = value.indexOf("var(", from);
		if (start < 0) return out + value.slice(from);
		const end = closingParen(value, start + 4);
		if (end < 0) return void 0;
		const inner = value.slice(start + 4, end);
		const comma = topLevelComma(inner);
		const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
		if (!name.startsWith("--")) return void 0;
		const token = lookup(name.slice(2))?.trim();
		const replacement = token ? substitute(token, lookup, depth + 1) : comma < 0 ? void 0 : substitute(inner.slice(comma + 1).trim(), lookup, depth + 1);
		if (replacement == null) return void 0;
		out += value.slice(from, start) + replacement;
		from = end + 1;
	}
}
/** Index of the `)` closing a parenthesis opened just before `from`, or -1. */
function closingParen(value, from) {
	let depth = 1;
	for (let i = from; i < value.length; i += 1) if (value[i] === "(") depth += 1;
	else if (value[i] === ")" && --depth === 0) return i;
	return -1;
}
function topLevelComma(value) {
	let depth = 0;
	for (let i = 0; i < value.length; i += 1) if (value[i] === "(") depth += 1;
	else if (value[i] === ")") depth -= 1;
	else if (value[i] === "," && depth === 0) return i;
	return -1;
}
/** A theme's tokens for one color scheme: dark tokens override light ones. */
function themeTokens(theme, scheme = "light") {
	return scheme === "dark" ? {
		...theme.tokens,
		...theme.darkTokens
	} : { ...theme.tokens };
}
// src/relation-geometry.ts
var SIDES = [
	"right",
	"left",
	"bottom",
	"top"
];
var CONTACT_FRACTIONS = [
	0,
	.5,
	1
];
var ROUTE_CLEARANCE = 8;
var ROUTE_CORNER_RADIUS = 12;
var GRAPH_OBSTACLE_LIMITS = [
	16,
	32,
	48
];
var DIRECT_BLOCKER_SAMPLE_LIMIT = 24;
var EPSILON = 1e-8;
function relationAnchorCandidates(rect, anchorForSide) {
	const anchors = [];
	for (const side of SIDES) {
		const base = anchorForSide(side);
		for (const fraction of CONTACT_FRACTIONS) if (side === "left" || side === "right") anchors.push({
			x: base.x,
			y: rect.y + rect.height * fraction,
			side
		});
		else anchors.push({
			x: rect.x + rect.width * fraction,
			y: base.y,
			side
		});
	}
	return anchors;
}
function routeRelationGeometry(source, target, obstacles) {
	const directRoutes = directCandidates(source, target).toSorted((a, b) => compareRoute(a, b));
	for (const route of directRoutes) if (routeIsClear(route, source.rect, target.rect, obstacles, ROUTE_CLEARANCE)) return route.geometry;
	const blockers = rankObstacles(directRoutes, source, target, obstacles, ROUTE_CLEARANCE);
	const corridors = outerCorridorCandidates(source, target, obstacles, blockers);
	const bestPadded = [...adaptiveVisibilityRoutes(source, target, blockers, obstacles, ROUTE_CLEARANCE).filter((route) => routeIsClear(route, source.rect, target.rect, obstacles, ROUTE_CLEARANCE)), ...corridors.filter((route) => routeIsClear(route, source.rect, target.rect, obstacles, ROUTE_CLEARANCE))].toSorted((a, b) => compareRoute(a, b)).at(0);
	if (bestPadded) return bestPadded.geometry;
	const bestBoundary = [...adaptiveVisibilityRoutes(source, target, blockers, obstacles, 0).filter((route) => routeIsClear(route, source.rect, target.rect, obstacles, 0)), ...corridors.filter((route) => routeIsClear(route, source.rect, target.rect, obstacles, 0))].toSorted((a, b) => compareRoute(a, b)).at(0);
	if (bestBoundary) return bestBoundary.geometry;
	const safeDirect = directRoutes.filter((route) => routeIsEndpointSafe(route, source.rect, target.rect));
	const safeCorridors = corridors.filter((route) => routeIsEndpointSafe(route, source.rect, target.rect));
	const fallback = (safeDirect.length || safeCorridors.length ? [...safeDirect, ...safeCorridors] : [...directRoutes, ...corridors]).map((route) => ({
		route,
		score: scoreCollisions(route, obstacles)
	})).toSorted((a, b) => compareCollisionScore(a.score, b.score)).at(0);
	if (fallback) return fallback.route.geometry;
	const sourceAnchor = source.anchors[0];
	const targetAnchor = target.anchors[0];
	if (!sourceAnchor || !targetAnchor) throw new Error("Relationship endpoints need boundary anchors");
	return makeRoute([{
		kind: "cubic",
		start: sourceAnchor,
		control1: sourceAnchor,
		control2: targetAnchor,
		end: targetAnchor
	}], sourceAnchor, targetAnchor).geometry;
}
function directCandidates(source, target) {
	const routes = [];
	for (const sourceAnchor of source.anchors) for (const targetAnchor of target.anchors) {
		const span = Math.hypot(targetAnchor.x - sourceAnchor.x, targetAnchor.y - sourceAnchor.y);
		const offset = Math.max(24, Math.min(span * .35, 110));
		const sourceVector = sideVector$1(sourceAnchor.side);
		const targetVector = sideVector$1(targetAnchor.side);
		routes.push(makeRoute([{
			kind: "cubic",
			start: sourceAnchor,
			control1: {
				x: sourceAnchor.x + sourceVector.x * offset,
				y: sourceAnchor.y + sourceVector.y * offset
			},
			control2: {
				x: targetAnchor.x + targetVector.x * offset,
				y: targetAnchor.y + targetVector.y * offset
			},
			end: targetAnchor
		}], sourceAnchor, targetAnchor));
	}
	return routes;
}
function adaptiveVisibilityRoutes(source, target, ranked, obstacles, clearance) {
	const routes = [];
	const promoted = /* @__PURE__ */ new Set();
	const graphPadding = clearance > 0 ? clearance + ROUTE_CORNER_RADIUS + 2 : .5;
	for (const limit of GRAPH_OBSTACLE_LIMITS) {
		const selected = [...ranked.filter((item) => promoted.has(item.rect)), ...ranked.filter((item) => !promoted.has(item.rect))].slice(0, limit).map((item) => item.rect);
		const route = visibilityRoute(source, target, selected, graphPadding, clearance, ROUTE_CORNER_RADIUS);
		if (!route) continue;
		routes.push(route);
		for (const rect of routeBlockingRects(route, obstacles, clearance)) if (!selected.includes(rect)) promoted.add(rect);
	}
	return routes;
}
function visibilityRoute(source, target, routingObstacles, graphPadding, validationPadding, cornerRadius) {
	const endpointRects = [source.rect, target.rect];
	const paddedRects = [...routingObstacles, ...endpointRects].map((rect) => expand(rect, graphPadding));
	const stageDistance = graphPadding + 2;
	const vertices = [];
	const sourceIndexes = /* @__PURE__ */ new Map();
	const targetIndexes = /* @__PURE__ */ new Map();
	for (const anchor of source.anchors) {
		const vector = sideVector$1(anchor.side);
		const point = {
			x: anchor.x + vector.x * stageDistance,
			y: anchor.y + vector.y * stageDistance
		};
		const index = vertices.length;
		vertices.push(point);
		sourceIndexes.set(index, anchor);
	}
	for (const anchor of target.anchors) {
		const vector = sideVector$1(anchor.side);
		const point = {
			x: anchor.x + vector.x * stageDistance,
			y: anchor.y + vector.y * stageDistance
		};
		const index = vertices.length;
		vertices.push(point);
		targetIndexes.set(index, anchor);
	}
	for (const rect of paddedRects) vertices.push(...corners(rect));
	const usableVertices = vertices.map((point, index) => ({
		point,
		index
	})).filter(({ point }) => !paddedRects.some((rect) => strictlyContains(rect, point)));
	const oldToNew = new Map(usableVertices.map(({ index }, nextIndex) => [index, nextIndex]));
	const points = usableVertices.map(({ point }) => point);
	const sourcePorts = /* @__PURE__ */ new Map();
	const targetPorts = /* @__PURE__ */ new Map();
	for (const [oldIndex, anchor] of sourceIndexes) {
		const nextIndex = oldToNew.get(oldIndex);
		if (nextIndex !== void 0) sourcePorts.set(nextIndex, anchor);
	}
	for (const [oldIndex, anchor] of targetIndexes) {
		const nextIndex = oldToNew.get(oldIndex);
		if (nextIndex !== void 0) targetPorts.set(nextIndex, anchor);
	}
	if (sourcePorts.size === 0 || targetPorts.size === 0) return void 0;
	const graph = points.map(() => []);
	for (let from = 0; from < points.length; from += 1) {
		const pointA = points[from];
		if (!pointA) continue;
		for (let to = from + 1; to < points.length; to += 1) {
			const pointB = points[to];
			if (!pointB || !segmentIsClear(pointA, pointB, paddedRects)) continue;
			const length = distance(pointA, pointB);
			graph[from]?.push({
				to,
				length
			});
			graph[to]?.push({
				to: from,
				length
			});
		}
	}
	const distances = points.map(() => Infinity);
	const previous = points.map(() => -1);
	const visited = points.map(() => false);
	for (const index of sourcePorts.keys()) {
		const anchor = sourcePorts.get(index);
		const point = points[index];
		if (!anchor || !point) continue;
		distances[index] = distance(anchor, point);
	}
	for (let pass = 0; pass < points.length; pass += 1) {
		let current = -1;
		let currentDistance = Infinity;
		for (let index = 0; index < distances.length; index += 1) {
			const candidate = distances[index];
			if (candidate === void 0 || visited[index] || candidate >= currentDistance) continue;
			current = index;
			currentDistance = candidate;
		}
		if (current < 0) break;
		visited[current] = true;
		for (const edge of graph[current] ?? []) {
			const nextDistance = currentDistance + edge.length;
			if (nextDistance + EPSILON >= (distances[edge.to] ?? Infinity)) continue;
			distances[edge.to] = nextDistance;
			previous[edge.to] = current;
		}
	}
	let targetIndex = -1;
	let totalDistance = Infinity;
	for (const [index, anchor] of targetPorts) {
		const point = points[index];
		const graphDistance = distances[index];
		if (!point || graphDistance === void 0) continue;
		const candidate = graphDistance + distance(point, anchor);
		if (candidate + EPSILON >= totalDistance) continue;
		targetIndex = index;
		totalDistance = candidate;
	}
	if (targetIndex < 0) return void 0;
	const indices = [];
	let pathIndex = targetIndex;
	while (pathIndex >= 0) {
		indices.unshift(pathIndex);
		pathIndex = previous[pathIndex] ?? -1;
	}
	const sourceIndex = indices[0];
	const sourceAnchor = sourceIndex === void 0 ? void 0 : sourcePorts.get(sourceIndex);
	const targetAnchor = targetPorts.get(targetIndex);
	if (!sourceAnchor || !targetAnchor) return void 0;
	const rawPoints = [
		sourceAnchor,
		...indices.map((index) => points[index]).filter((point) => point !== void 0),
		targetAnchor
	];
	return [
		cornerRadius,
		cornerRadius / 2,
		cornerRadius / 4,
		0
	].map((radius) => makeRoute(roundedSegments(rawPoints, radius), sourceAnchor, targetAnchor)).filter((route) => routeIsClear(route, source.rect, target.rect, routingObstacles, validationPadding)).toSorted((a, b) => compareRoute(a, b))[0];
}
function rankObstacles(routes, source, target, obstacles, padding) {
	const sample = routes.filter((_, index) => index === 0 || index === routes.length - 1 || index % Math.max(1, Math.floor(routes.length / DIRECT_BLOCKER_SAMPLE_LIMIT)) === 0);
	const sourceCenter = center(source.rect);
	const targetCenter = center(target.rect);
	return obstacles.map((rect, index) => ({
		rect,
		index,
		directBlockers: sample.filter((route) => routeIntersectsRect(route, expand(rect, padding))).length,
		distance: Math.max(0, distanceToSegment(center(rect), sourceCenter, targetCenter) - Math.hypot(rect.width, rect.height) / 2)
	})).toSorted((a, b) => {
		if (a.directBlockers !== b.directBlockers) return b.directBlockers - a.directBlockers;
		if (a.distance !== b.distance) return a.distance - b.distance;
		return a.index - b.index;
	});
}
function outerCorridorCandidates(source, target, obstacles, ranked) {
	const blockingRects = ranked.filter((item) => item.directBlockers > 0).map((item) => item.rect);
	const bounds = rectBounds([
		...blockingRects.length > 0 ? blockingRects : obstacles,
		source.rect,
		target.rect
	]);
	const margin = 22;
	const corridorCoordinates = /* @__PURE__ */ new Map([
		["top", bounds.y - margin],
		["bottom", bounds.y + bounds.height + margin],
		["left", bounds.x - margin],
		["right", bounds.x + bounds.width + margin]
	]);
	const routes = [];
	for (const side of SIDES) {
		const sourceAnchor = centerAnchor(source.anchors, side, source.rect);
		const targetAnchor = centerAnchor(target.anchors, side, target.rect);
		const corridor = corridorCoordinates.get(side);
		if (!sourceAnchor || !targetAnchor || corridor === void 0) continue;
		const vector = sideVector$1(side);
		const stageDistance = margin;
		const sourceStage = {
			x: sourceAnchor.x + vector.x * stageDistance,
			y: sourceAnchor.y + vector.y * stageDistance
		};
		const targetStage = {
			x: targetAnchor.x + vector.x * stageDistance,
			y: targetAnchor.y + vector.y * stageDistance
		};
		const points = [
			sourceAnchor,
			sourceStage,
			side === "top" || side === "bottom" ? {
				x: sourceStage.x,
				y: corridor
			} : {
				x: corridor,
				y: sourceStage.y
			},
			side === "top" || side === "bottom" ? {
				x: targetStage.x,
				y: corridor
			} : {
				x: corridor,
				y: targetStage.y
			},
			targetStage,
			targetAnchor
		];
		for (const radius of [
			ROUTE_CORNER_RADIUS,
			ROUTE_CORNER_RADIUS / 2,
			0
		]) routes.push(makeRoute(roundedSegments(points, radius), sourceAnchor, targetAnchor));
	}
	return routes;
}
function centerAnchor(anchors, side, rect) {
	const centerPoint = center(rect);
	return anchors.filter((anchor) => anchor.side === side).toSorted((a, b) => Math.hypot(a.x - centerPoint.x, a.y - centerPoint.y) - Math.hypot(b.x - centerPoint.x, b.y - centerPoint.y))[0];
}
function rectBounds(rects) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const rect of rects) {
		minX = Math.min(minX, rect.x);
		minY = Math.min(minY, rect.y);
		maxX = Math.max(maxX, rect.x + rect.width);
		maxY = Math.max(maxY, rect.y + rect.height);
	}
	if (!rects.length) return {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	};
	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	};
}
function roundedSegments(points, radius) {
	const compact = points.filter((point, index) => index === 0 || distance(point, points[index - 1] ?? point) > EPSILON);
	if (compact.length < 2) return [];
	const segments = [];
	let current = compact[0];
	if (!current) return segments;
	for (let index = 1; index < compact.length - 1; index += 1) {
		const previous = compact[index - 1];
		const corner = compact[index];
		const next = compact[index + 1];
		if (!previous || !corner || !next) continue;
		const incomingLength = distance(previous, corner);
		const outgoingLength = distance(corner, next);
		if (incomingLength <= EPSILON || outgoingLength <= EPSILON) continue;
		const incoming = {
			x: (corner.x - previous.x) / incomingLength,
			y: (corner.y - previous.y) / incomingLength
		};
		const outgoing = {
			x: (next.x - corner.x) / outgoingLength,
			y: (next.y - corner.y) / outgoingLength
		};
		const dot = incoming.x * outgoing.x + incoming.y * outgoing.y;
		const radiusAtCorner = dot > .999 || dot < -.999 || radius <= EPSILON ? 0 : Math.min(radius, incomingLength * .35, outgoingLength * .35);
		if (radiusAtCorner <= EPSILON) {
			if (current && distance(current, corner) > EPSILON) segments.push({
				kind: "line",
				start: current,
				end: corner
			});
			current = corner;
			continue;
		}
		const entry = {
			x: corner.x - incoming.x * radiusAtCorner,
			y: corner.y - incoming.y * radiusAtCorner
		};
		const exit = {
			x: corner.x + outgoing.x * radiusAtCorner,
			y: corner.y + outgoing.y * radiusAtCorner
		};
		if (current && distance(current, entry) > EPSILON) segments.push({
			kind: "line",
			start: current,
			end: entry
		});
		segments.push({
			kind: "cubic",
			start: entry,
			control1: {
				x: entry.x + (corner.x - entry.x) * 2 / 3,
				y: entry.y + (corner.y - entry.y) * 2 / 3
			},
			control2: {
				x: exit.x + (corner.x - exit.x) * 2 / 3,
				y: exit.y + (corner.y - exit.y) * 2 / 3
			},
			end: exit
		});
		current = exit;
	}
	const last = compact.at(-1);
	if (current && last && distance(current, last) > EPSILON) segments.push({
		kind: "line",
		start: current,
		end: last
	});
	return segments;
}
function makeRoute(segments, sourceAnchor, targetAnchor) {
	const first = segments[0];
	const last = segments.at(-1);
	const points = routeSamples(segments);
	const lines = sampleLines(points);
	const start = first?.start ?? {
		x: 0,
		y: 0
	};
	const end = last?.end ?? start;
	const anchors = [sourceAnchor ?? {
		...start,
		side: "right"
	}, targetAnchor ?? {
		...end,
		side: "left"
	}];
	const middle = arcMidpoint(points);
	const angle = finalAngle(last);
	return {
		geometry: {
			d: pathData(segments),
			p0: anchors[0],
			p3: anchors[1],
			midX: middle.x,
			midY: middle.y,
			angle,
			bounds: segmentBounds(segments),
			length: pathLength(points)
		},
		samples: points,
		lines,
		segments
	};
}
function routeIsClear(route, source, target, obstacles, padding) {
	if (!routeIsEndpointSafe(route, source, target)) return false;
	const relevant = obstacles.map((rect) => expand(rect, padding)).filter((rect) => rectIntersects(rect, route.geometry.bounds));
	return route.lines.every((segment) => relevant.every((rect) => !segmentIntersectsRect(segment.start, segment.end, rect)));
}
function routeIsEndpointSafe(route, source, target) {
	return route.lines.every((segment) => !segmentIntersectsRect(segment.start, segment.end, source) && !segmentIntersectsRect(segment.start, segment.end, target));
}
function routeBlockingRects(route, obstacles, padding) {
	return obstacles.filter((rect) => routeIntersectsRect(route, expand(rect, padding)));
}
function routeIntersectsRect(route, rect) {
	if (!rectIntersects(route.geometry.bounds, rect)) return false;
	return route.lines.some((segment) => segmentIntersectsRect(segment.start, segment.end, rect));
}
function scoreCollisions(route, obstacles) {
	const segments = route.lines;
	let crossed = 0;
	let insideLength = 0;
	for (const rect of obstacles) {
		let crossedRect = false;
		for (const segment of segments) {
			const interval = segmentRectInterval(segment.start, segment.end, rect);
			if (!interval) continue;
			crossedRect = true;
			insideLength += distance(segment.start, segment.end) * (interval.end - interval.start);
		}
		if (crossedRect) crossed += 1;
	}
	return {
		crossed,
		insideLength,
		length: route.geometry.length
	};
}
function compareCollisionScore(a, b) {
	if (a.crossed !== b.crossed) return a.crossed - b.crossed;
	if (Math.abs(a.insideLength - b.insideLength) > EPSILON) return a.insideLength - b.insideLength;
	return a.length - b.length;
}
function compareRoute(a, b) {
	if (Math.abs(a.geometry.length - b.geometry.length) > EPSILON) return a.geometry.length - b.geometry.length;
	return a.segments.length - b.segments.length;
}
function routeSamples(segments) {
	const samples = [];
	for (const segment of segments) {
		const points = sampleSegment(segment);
		for (const point of points) if (samples.length === 0 || distance(samples.at(-1) ?? point, point) > EPSILON) samples.push(point);
	}
	return samples;
}
function sampleLines(points) {
	return points.slice(1).flatMap((point, index) => {
		const start = points[index];
		return start ? [{
			kind: "line",
			start,
			end: point
		}] : [];
	});
}
function sampleSegment(segment) {
	if (segment.kind === "line") return [segment.start, segment.end];
	const length = distance(segment.start, segment.control1) + distance(segment.control1, segment.control2) + distance(segment.control2, segment.end);
	const steps = Math.min(256, Math.max(16, Math.ceil(length / 2)));
	const points = [segment.start];
	for (let step = 1; step <= steps; step += 1) {
		const t = step / steps;
		const u = 1 - t;
		points.push({
			x: u ** 3 * segment.start.x + 3 * u ** 2 * t * segment.control1.x + 3 * u * t ** 2 * segment.control2.x + t ** 3 * segment.end.x,
			y: u ** 3 * segment.start.y + 3 * u ** 2 * t * segment.control1.y + 3 * u * t ** 2 * segment.control2.y + t ** 3 * segment.end.y
		});
	}
	return points;
}
function pathData(segments) {
	const first = segments[0];
	if (!first) return "";
	let d = `M${number(first.start.x)},${number(first.start.y)}`;
	for (const segment of segments) if (segment.kind === "line") d += `L${number(segment.end.x)},${number(segment.end.y)}`;
	else d += `C${number(segment.control1.x)},${number(segment.control1.y)} ${number(segment.control2.x)},${number(segment.control2.y)} ${number(segment.end.x)},${number(segment.end.y)}`;
	return d;
}
function segmentBounds(segments) {
	const points = segments.flatMap((segment) => segment.kind === "line" ? [segment.start, segment.end] : [
		segment.start,
		segment.control1,
		segment.control2,
		segment.end
	]);
	if (points.length === 0) return {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	};
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	const maxX = Math.max(...xs);
	const maxY = Math.max(...ys);
	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	};
}
function finalAngle(segment) {
	if (!segment) return 0;
	const tangent = segment.kind === "cubic" ? {
		x: segment.end.x - segment.control2.x,
		y: segment.end.y - segment.control2.y
	} : {
		x: segment.end.x - segment.start.x,
		y: segment.end.y - segment.start.y
	};
	return Math.atan2(tangent.y, tangent.x);
}
function arcMidpoint(points) {
	const total = pathLength(points);
	let travelled = 0;
	for (let index = 1; index < points.length; index += 1) {
		const previous = points[index - 1];
		const current = points[index];
		if (!previous || !current) continue;
		const segmentLength = distance(previous, current);
		if (travelled + segmentLength >= total / 2) {
			const ratio = segmentLength > 0 ? (total / 2 - travelled) / segmentLength : 0;
			return {
				x: previous.x + (current.x - previous.x) * ratio,
				y: previous.y + (current.y - previous.y) * ratio
			};
		}
		travelled += segmentLength;
	}
	return points.at(-1) ?? {
		x: 0,
		y: 0
	};
}
function pathLength(points) {
	let length = 0;
	for (let index = 1; index < points.length; index += 1) {
		const previous = points[index - 1];
		const current = points[index];
		if (previous && current) length += distance(previous, current);
	}
	return length;
}
function segmentIsClear(a, b, obstacles) {
	return obstacles.every((rect) => !segmentIntersectsRect(a, b, rect));
}
function segmentIntersectsRect(a, b, rect) {
	const interval = segmentRectInterval(a, b, rect);
	return interval !== void 0 && interval.start < interval.end;
}
function segmentRectInterval(a, b, rect) {
	const xInterval = axisInterval(a.x, b.x - a.x, rect.x, rect.x + rect.width);
	const yInterval = axisInterval(a.y, b.y - a.y, rect.y, rect.y + rect.height);
	if (!xInterval || !yInterval) return void 0;
	const start = Math.max(0, xInterval.start, yInterval.start);
	const end = Math.min(1, xInterval.end, yInterval.end);
	return start < end ? {
		start,
		end
	} : void 0;
}
function axisInterval(start, delta, min, max) {
	if (Math.abs(delta) <= EPSILON) return start > min && start < max ? {
		start: Number.NEGATIVE_INFINITY,
		end: Number.POSITIVE_INFINITY
	} : void 0;
	const first = (min - start) / delta;
	const second = (max - start) / delta;
	return first < second ? {
		start: first,
		end: second
	} : {
		start: second,
		end: first
	};
}
function rectIntersects(a, b) {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
function strictlyContains(rect, point) {
	return point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;
}
function expand(rect, padding) {
	return {
		x: rect.x - padding,
		y: rect.y - padding,
		width: rect.width + padding * 2,
		height: rect.height + padding * 2
	};
}
function corners(rect) {
	return [
		{
			x: rect.x,
			y: rect.y
		},
		{
			x: rect.x + rect.width,
			y: rect.y
		},
		{
			x: rect.x + rect.width,
			y: rect.y + rect.height
		},
		{
			x: rect.x,
			y: rect.y + rect.height
		}
	];
}
function center(rect) {
	return {
		x: rect.x + rect.width / 2,
		y: rect.y + rect.height / 2
	};
}
function distanceToSegment(point, start, end) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared <= EPSILON) return distance(point, start);
	const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
	return Math.hypot(point.x - (start.x + dx * projection), point.y - (start.y + dy * projection));
}
function distance(a, b) {
	return Math.hypot(b.x - a.x, b.y - a.y);
}
function sideVector$1(side) {
	if (side === "left") return {
		x: -1,
		y: 0
	};
	if (side === "right") return {
		x: 1,
		y: 0
	};
	if (side === "top") return {
		x: 0,
		y: -1
	};
	return {
		x: 0,
		y: 1
	};
}
function number(value) {
	return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
// src/relation.ts
function sideVector(side) {
	if (side === "left") return {
		x: -1,
		y: 0
	};
	if (side === "right") return {
		x: 1,
		y: 0
	};
	if (side === "top") return {
		x: 0,
		y: -1
	};
	return {
		x: 0,
		y: 1
	};
}
function computeRelationCurve(p0, p3, srcSide, tgtSide) {
	const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
	const offset = Math.max(30, Math.min(dist * .4, 150));
	const v0 = sideVector(srcSide);
	const v3 = sideVector(tgtSide);
	const p1 = {
		x: p0.x + v0.x * offset,
		y: p0.y + v0.y * offset
	};
	const p2 = {
		x: p3.x + v3.x * offset,
		y: p3.y + v3.y * offset
	};
	const d = `M${p0.x},${p0.y}C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
	let tanX = p3.x - p2.x;
	let tanY = p3.y - p2.y;
	if (Math.hypot(tanX, tanY) === 0) {
		tanX = p3.x - p0.x;
		tanY = p3.y - p0.y;
	}
	const angle = Math.atan2(tanY, tanX);
	return {
		p0,
		p1,
		p2,
		p3,
		d,
		arrowD: arrowPathData(p3, angle),
		midX: .125 * p0.x + .375 * p1.x + .375 * p2.x + .125 * p3.x,
		midY: .125 * p0.y + .375 * p1.y + .375 * p2.y + .125 * p3.y,
		angle
	};
}
var ROUTE_CACHE_LIMIT = 256;
var routeCache = /* @__PURE__ */ new Map();
function renderRelationEdges({ edges, identities, nodesById, rootId, folded, theme }) {
	const primitives = [];
	const visibleNodes = [...nodesById.values()];
	const obstacleKey = visibleNodes.map((node) => {
		const { x, y, width, height } = node.rect;
		return `${node.node.id},${x},${y},${width},${height}`;
	}).join(";");
	for (const edge of edges) {
		const sourceNodeId = edge.from === "root" ? rootId ?? "" : identities?.get(edge.from) ?? edge.from;
		const targetNodeId = edge.to === "root" ? rootId ?? "" : identities?.get(edge.to) ?? edge.to;
		if (folded?.has(sourceNodeId) || folded?.has(targetNodeId)) continue;
		const source = nodesById.get(sourceNodeId);
		const target = nodesById.get(targetNodeId);
		if (!source || !target) continue;
		if (source.ctx.folded || target.ctx.folded) continue;
		const sourceAnchors = relationAnchorCandidates(source.rect, (side) => theme.node.anchor(source.rect, side, source.ctx));
		const targetAnchors = relationAnchorCandidates(target.rect, (side) => theme.node.anchor(target.rect, side, target.ctx));
		const obstacles = visibleNodes.filter((node) => node.node.id !== sourceNodeId && node.node.id !== targetNodeId).map((node) => node.rect);
		const anchorKey = [...sourceAnchors, ...targetAnchors].map((anchor) => `${anchor.side},${anchor.x},${anchor.y}`).join(";");
		const cacheKey = `${edge.from},${edge.to}|${obstacleKey}|${anchorKey}`;
		const cached = routeCache.get(cacheKey);
		let geometry;
		if (cached) {
			routeCache.delete(cacheKey);
			routeCache.set(cacheKey, cached);
			geometry = cached;
		} else {
			geometry = routeRelationGeometry({
				rect: source.rect,
				anchors: sourceAnchors
			}, {
				rect: target.rect,
				anchors: targetAnchors
			}, obstacles);
			routeCache.set(cacheKey, geometry);
			if (routeCache.size > ROUTE_CACHE_LIMIT) {
				const oldest = routeCache.keys().next().value;
				if (oldest !== void 0) routeCache.delete(oldest);
			}
		}
		const arrowD = arrowPathData(geometry.p3, geometry.angle);
		const curvePath = {
			kind: "path",
			d: geometry.d,
			stroke: "var(--mm-edge-relation, #8c959f)",
			strokeWidth: 1.5,
			strokeDashArray: [5, 4]
		};
		const hitPath = {
			kind: "path",
			d: geometry.d,
			stroke: "transparent",
			strokeWidth: 10
		};
		const children = [
			curvePath,
			{
				kind: "group",
				key: `relation-hit:${edge.from}:${edge.to}`,
				bounds: expandBounds(geometry.bounds, 6),
				children: [hitPath]
			},
			{
				kind: "path",
				d: arrowD,
				fill: "var(--mm-edge-relation, #8c959f)"
			}
		];
		let labelBounds;
		if (edge.label && edge.label.length > 0) {
			const labelText = edge.label;
			const labelWidth = Math.max(28, labelText.length * 7 + 14);
			const labelHeight = 20;
			labelBounds = {
				x: geometry.midX - labelWidth / 2,
				y: geometry.midY - labelHeight / 2,
				width: labelWidth,
				height: labelHeight
			};
			const rect = {
				kind: "rect",
				x: labelBounds.x,
				y: labelBounds.y,
				w: labelWidth,
				h: labelHeight,
				r: 4,
				fill: "var(--mm-bg, #ffffff)",
				stroke: "var(--mm-edge-relation, #8c959f)",
				strokeWidth: 1
			};
			const text = {
				kind: "text",
				x: 0,
				y: 0,
				runs: [{
					text: labelText,
					x: geometry.midX - labelText.length * 7 / 2,
					y: geometry.midY + 4,
					font: SYSTEM_FONT,
					fill: "var(--mm-edge-relation-label, #57606a)"
				}]
			};
			children.push(rect, text);
		}
		const bounds = expandBounds(labelBounds ? unionBounds(geometry.bounds, labelBounds) : geometry.bounds, 12);
		const relation = {
			kind: "group",
			key: `relation:${edge.from}:${edge.to}`,
			bounds,
			children
		};
		const midpointBounds = {
			x: geometry.midX - .5,
			y: geometry.midY - .5,
			width: 1,
			height: 1
		};
		const midpoint = {
			kind: "group",
			key: `relation-midpoint:${edge.from}:${edge.to}`,
			bounds: midpointBounds,
			children: [{
				kind: "rect",
				x: midpointBounds.x,
				y: midpointBounds.y,
				w: midpointBounds.width,
				h: midpointBounds.height,
				fill: "none"
			}]
		};
		primitives.push(relation, midpoint);
	}
	return primitives;
}
function arrowPathData(p3, angle) {
	const baseX = p3.x - 8 * Math.cos(angle);
	const baseY = p3.y - 8 * Math.sin(angle);
	const w1X = baseX - 4 * Math.sin(angle);
	const w1Y = baseY + 4 * Math.cos(angle);
	const w2X = baseX + 4 * Math.sin(angle);
	const w2Y = baseY - 4 * Math.cos(angle);
	return `M${p3.x},${p3.y}L${w1X},${w1Y}L${w2X},${w2Y}Z`;
}
function expandBounds(rect, padding) {
	return {
		x: rect.x - padding,
		y: rect.y - padding,
		width: rect.width + padding * 2,
		height: rect.height + padding * 2
	};
}
function unionBounds(a, b) {
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	const right = Math.max(a.x + a.width, b.x + b.width);
	const bottom = Math.max(a.y + a.height, b.y + b.height);
	return {
		x,
		y,
		width: right - x,
		height: bottom - y
	};
}
// src/text.ts
function registry(plugins) {
	const styles = /* @__PURE__ */ new Map();
	const atoms = /* @__PURE__ */ new Map();
	for (const plugin of plugins) {
		for (const [type, fn] of Object.entries(plugin.styles ?? {})) styles.set(type, fn);
		for (const [type, fn] of Object.entries(plugin.atoms ?? {})) atoms.set(type, fn);
	}
	return {
		styles,
		atoms
	};
}
/** Apply plugin transforms to a node's content, in plugin order. */
function transformContent(plugins, ctx) {
	let content = ctx.node.content;
	for (const plugin of plugins) if (plugin.transform) content = plugin.transform(content, ctx.node);
	return content;
}
/** Turn inline content into styled items. Unknown containers pass their children through. */
function flatten(content, base, reg, ctx) {
	const items = [];
	const text = (value, style, spans) => {
		if (value) items.push({
			kind: "text",
			text: value.replace(/\s*\n\s*/g, " "),
			style,
			spans,
			width: 0
		});
	};
	const visit = (nodes, style, spans) => {
		for (const node of nodes) {
			const atom = reg.atoms.get(node.type);
			if (atom) {
				const size = atom.measure(node, style, ctx);
				items.push({
					kind: "atom",
					inline: node,
					renderer: atom,
					size,
					style,
					spans,
					width: size.width
				});
				continue;
			}
			if (node.type === "break") {
				items.push({
					kind: "newline",
					style,
					spans,
					width: 0
				});
				continue;
			}
			const styler = reg.styles.get(node.type);
			if (styler) {
				const result = styler(node, style, ctx);
				const inner = {
					font: {
						...style.font,
						...result.font
					},
					fill: result.fill ?? style.fill
				};
				const span = result.decoration && {
					decoration: result.decoration,
					style: inner
				};
				const innerSpans = span ? [...spans, span] : spans;
				const padding = result.decoration?.padding ?? 0;
				if (padding) items.push({
					kind: "pad",
					style: inner,
					spans: innerSpans,
					width: padding
				});
				if ("value" in node) text(node.value, inner, innerSpans);
				else if ("children" in node) visit(node.children, inner, innerSpans);
				if (padding) items.push({
					kind: "pad",
					style: inner,
					spans: innerSpans,
					width: padding
				});
			} else if (node.type === "image") text(node.alt ?? "", style, spans);
			else if ("value" in node) text(node.value, style, spans);
			else if ("children" in node) visit(node.children, style, spans);
		}
	};
	visit(content, base, []);
	return items;
}
var segmenter = new Intl.Segmenter(void 0, { granularity: "word" });
var graphemes = new Intl.Segmenter(void 0, { granularity: "grapheme" });
var CJK = /[⺀-鿿가-힣豈-﫿＀-￯]/u;
/** Characters that must not start a line. */
var NO_BREAK_BEFORE = /^[\p{Pe}\p{Pf}\p{Po}、。，！？]/u;
/** Group items into unbreakable units, using word boundaries and CJK rules. */
function toUnits(items, ctx) {
	const units = [];
	let current;
	let prevSpace = true;
	let prevText = "";
	const start = (space) => {
		current = {
			items: [],
			width: 0,
			space,
			newline: false
		};
		units.push(current);
		return current;
	};
	for (const item of items) {
		if (item.kind === "newline") {
			units.push({
				items: [],
				width: 0,
				space: false,
				newline: true
			});
			current = void 0;
			prevSpace = true;
			continue;
		}
		if (item.kind === "atom") {
			start(false).items.push(item);
			current.width = item.width;
			current = void 0;
			prevSpace = true;
			continue;
		}
		if (item.kind === "pad") {
			const unit = !current || current.space || prevSpace ? start(false) : current;
			unit.items.push(item);
			unit.width += item.width;
			prevSpace = false;
			continue;
		}
		for (const { segment } of segmenter.segment(item.text)) {
			const space = /^\s+$/.test(segment);
			const breakable = space || prevSpace || (CJK.test(segment[0]) || CJK.test(prevText.at(-1) ?? "")) && !NO_BREAK_BEFORE.test(segment);
			const value = space ? " " : segment;
			const unit = !current || breakable || current.space ? start(space) : current;
			const width = ctx.measurer.measure(value, item.style.font);
			const last = unit.items.at(-1);
			if (last?.kind === "text" && last.style === item.style && last.spans === item.spans) {
				last.text += value;
				last.width += width;
			} else unit.items.push({
				...item,
				text: value,
				width
			});
			unit.width += width;
			prevSpace = space;
			prevText = segment;
		}
	}
	return units;
}
/** Break a unit wider than the line into grapheme-sized units. */
function splitUnit(unit, ctx) {
	const result = [];
	for (const item of unit.items) {
		if (item.kind !== "text") {
			result.push({
				items: [item],
				width: item.width,
				space: false,
				newline: false
			});
			continue;
		}
		for (const { segment } of graphemes.segment(item.text)) {
			const width = ctx.measurer.measure(segment, item.style.font);
			result.push({
				items: [{
					...item,
					text: segment,
					width
				}],
				width,
				space: false,
				newline: false
			});
		}
	}
	return result;
}
function breakLines(units, wrapWidth, ctx) {
	const lines = [[]];
	let lineWidth = 0;
	const push = (unit) => {
		const line = lines.at(-1);
		if (unit.newline) {
			lines.push([]);
			lineWidth = 0;
			return;
		}
		if (unit.space && !line.length) return;
		if (wrapWidth > 0 && !unit.space && line.length && lineWidth + unit.width > wrapWidth) {
			while (line.at(-1)?.space) lineWidth -= line.pop().width;
			lines.push([]);
			lineWidth = 0;
			if (unit.width > wrapWidth) return void splitUnit(unit, ctx).forEach(push);
		} else if (wrapWidth > 0 && !line.length && unit.width > wrapWidth) {
			const parts = splitUnit(unit, ctx);
			if (parts.length > 1) return void parts.forEach(push);
		}
		lines.at(-1).push(unit);
		lineWidth += unit.width;
	};
	units.forEach(push);
	for (const line of lines) while (line.at(-1)?.space) line.pop();
	return lines;
}
/** Lay out inline content into runs, decorations and atoms, wrapping at `wrapWidth`. */
function layoutText(content, options) {
	const { style, plugins, ctx } = options;
	const lines = breakLines(toUnits(flatten(content, style, registry(plugins), ctx), ctx), options.wrapWidth ?? 0, ctx);
	const { font } = style;
	const textAscent = (font.lineHeight + font.size * .7) / 2;
	const backgrounds = [];
	const overlays = [];
	const atoms = [];
	const links = [];
	const runs = [];
	const lineWidths = lines.map((line) => line.reduce((sum, unit) => sum + unit.items.reduce((w, item) => w + item.width, 0), 0));
	const width = Math.max(0, ...lineWidths);
	const alignFactor = {
		start: 0,
		center: .5,
		end: 1
	}[options.align ?? "start"];
	let top = 0;
	for (const [index, line] of lines.entries()) {
		const placed = [];
		let x = (width - lineWidths[index]) * alignFactor;
		for (const item of line.flatMap((unit) => unit.items)) {
			placed.push({
				item,
				x
			});
			x += item.width;
		}
		let ascent = textAscent;
		let descent = font.lineHeight - textAscent;
		for (const { item } of placed) {
			if (item.kind !== "atom") continue;
			ascent = Math.max(ascent, item.size.baseline);
			descent = Math.max(descent, item.size.height - item.size.baseline);
		}
		const baseline = top + ascent;
		const lineHeight = ascent + descent;
		for (const { item, x: itemX } of placed) if (item.kind === "text") {
			const last = runs.at(-1);
			if (last && last.y === baseline && last.font === item.style.font && last.fill === item.style.fill && last.x + (last.width ?? 0) === itemX) {
				last.text += item.text;
				last.width = (last.width ?? 0) + item.width;
			} else {
				const run = {
					text: item.text,
					x: itemX,
					y: baseline,
					font: item.style.font,
					fill: item.style.fill,
					width: item.width
				};
				runs.push(run);
			}
		} else if (item.kind === "atom") {
			const box = {
				x: itemX,
				y: baseline - item.size.baseline,
				width: item.size.width,
				height: item.size.height
			};
			atoms.push(...item.renderer.render(item.inline, box, item.style, ctx));
		}
		const extents = /* @__PURE__ */ new Map();
		for (const { item, x: itemX } of placed) for (const span of item.spans) {
			const extent = extents.get(span);
			if (extent) extent[1] = itemX + item.width;
			else extents.set(span, [itemX, itemX + item.width]);
		}
		for (const [span, [x0, x1]] of extents) {
			const { decoration: d, style: s } = span;
			if (d.background) backgrounds.push({
				kind: "rect",
				x: x0,
				y: baseline - s.font.size * .95,
				w: x1 - x0,
				h: s.font.size * 1.3,
				r: d.radius,
				fill: d.background
			});
			if (d.strike) {
				const y = baseline - s.font.size * .3;
				overlays.push({
					kind: "path",
					d: `M${x0},${y}H${x1}`,
					stroke: d.strike,
					strokeWidth: Math.max(1, s.font.size / 14)
				});
			}
			if (d.href) links.push({
				kind: "link",
				href: d.href,
				rect: {
					x: x0,
					y: top,
					width: x1 - x0,
					height: lineHeight
				}
			});
		}
		top += lineHeight;
	}
	return {
		primitives: [
			...backgrounds,
			...runs.length ? [{
				kind: "text",
				x: 0,
				y: 0,
				runs
			}] : [],
			...overlays,
			...atoms,
			...links
		],
		runs,
		width,
		height: top,
		lines: lines.length
	};
}
// src/render.ts
/** Ids from the root to every node, both included. */
function nodePaths(root) {
	const paths = /* @__PURE__ */ new Map();
	const visit = (node, parent) => {
		const path = [...parent, node.id];
		paths.set(node.id, path);
		for (const child of node.children) visit(child, path);
	};
	visit(root, []);
	return paths;
}
/** Lay out a node's label. Alignment does not change the size. */
function labelLayout(node, theme, options, label, align, defer) {
	const plugins = options.plugins ?? defaultContentPlugins;
	const ctx = {
		theme,
		measurer: options.measurer,
		node,
		wrapWidth: options.wrapWidth,
		defer
	};
	return layoutText(transformContent(plugins, ctx), {
		style: {
			font: label.font,
			fill: label.fill
		},
		wrapWidth: options.wrapWidth,
		plugins,
		ctx,
		align
	});
}
/**
* Measure the label and box of every visible node. Content that is not ready yet (see
* {@link InlineContext.defer}) is reported to `defer`.
*/
function measureTree(root, options, defer) {
	const theme = options.theme ?? classicTheme;
	const result = /* @__PURE__ */ new Map();
	const paths = nodePaths(root);
	for (const node of visibleNodes(root, options.folded)) {
		const path = paths.get(node.id);
		const ctx = {
			depth: path.length - 1,
			path,
			hasChildren: node.children.length > 0,
			folded: !!options.folded?.has(node.id)
		};
		const label = resolveLabelStyle(theme, node, ctx);
		const [top, right, bottom, left] = label.padding;
		const text = labelLayout(node, theme, options, label, void 0, defer);
		const box = theme.node.measure ? theme.node.measure(text, node, ctx, label) : {
			width: text.width + left + right,
			height: Math.max(text.height + top + bottom, theme.node.minHeight ?? 0)
		};
		result.set(node.id, {
			text,
			box,
			label
		});
	}
	return result;
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value) {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isRenderGroup(value) {
	if (!isRecord(value)) return false;
	return isStringArray(value["roots"]);
}
function readGroups(data) {
	const groups = data["groups"];
	if (!Array.isArray(groups)) return [];
	return groups.filter(isRenderGroup);
}
function groupPadding(layoutName) {
	if (layoutName === "org-chart") return {
		top: 16,
		right: 16,
		bottom: 20,
		left: 16
	};
	if (layoutName === "two-sided") return {
		top: 14,
		right: 20,
		bottom: 14,
		left: 20
	};
	return {
		top: 14,
		right: 20,
		bottom: 14,
		left: 16
	};
}
/** Measure, lay out and draw a tree as backend-neutral primitives. */
function renderTree(root, options) {
	const theme = options.theme ?? classicTheme;
	const tasks = [];
	const measured = measureTree(root, options, (task) => tasks.push(task));
	const paths = nodePaths(root);
	const contexts = /* @__PURE__ */ new Map();
	const branchOf = (item) => {
		let first = item;
		while (first.depth > 1 && first.parent) first = first.parent;
		return first.parent ? first.parent.children.indexOf(first) : 0;
	};
	const contextOf = (item) => {
		let ctx = contexts.get(item.node.id);
		if (!ctx) {
			ctx = {
				depth: item.depth,
				path: paths.get(item.node.id),
				branch: branchOf(item),
				hasChildren: item.node.children.length > 0,
				folded: item.folded,
				direction: item.direction
			};
			contexts.set(item.node.id, ctx);
		}
		return ctx;
	};
	const layout = (options.layout ?? treeLayout).layout(root, {
		sizes: new Map([...measured].map(([id, { box }]) => [id, box])),
		folded: options.folded,
		levelGap: options.levelGap,
		siblingGap: options.siblingGap
	});
	const rawGroups = options.groups ?? readGroups(root.data);
	const pad = groupPadding(options.layout?.name);
	const drawGroups = [];
	rawGroups.forEach((group, index) => {
		if (group.roots.length === 0) return;
		if (group.roots.some((r) => {
			const p = paths.get(r);
			return !p || p.some((id) => options.folded?.has(id));
		})) return;
		const groupNodes = layout.nodes.filter((item) => {
			const path = paths.get(item.node.id);
			return path !== void 0 && group.roots.some((r) => path.includes(r));
		});
		if (groupNodes.length === 0) return;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const node of groupNodes) {
			if (node.rect.x < minX) minX = node.rect.x;
			if (node.rect.y < minY) minY = node.rect.y;
			if (node.rect.x + node.rect.width > maxX) maxX = node.rect.x + node.rect.width;
			if (node.rect.y + node.rect.height > maxY) maxY = node.rect.y + node.rect.height;
		}
		const rect = {
			x: minX - pad.left,
			y: minY - pad.top,
			width: maxX - minX + pad.left + pad.right,
			height: maxY - minY + pad.top + pad.bottom
		};
		drawGroups.push({
			id: group.id ?? `group-${index}`,
			roots: [...group.roots],
			label: group.label ?? null,
			rect
		});
	});
	const state = {
		nodes: layout.nodes.map((item) => {
			const ctx = contextOf(item);
			const measuredNode = measured.get(item.node.id);
			let { text } = measuredNode;
			const align = theme.node.textAlign?.(ctx) ?? "start";
			if (align !== "start" && text.lines > 1) text = labelLayout(item.node, theme, options, measuredNode.label, align, (task) => tasks.push(task));
			return {
				node: item.node,
				parentId: item.parent?.node.id,
				rect: item.rect,
				ctx,
				text,
				label: measuredNode.label,
				presence: 1
			};
		}),
		groups: drawGroups,
		rootId: root.id,
		relations: options.graph?.edges,
		identities: options.identities,
		folded: options.folded
	};
	const primitives = drawState(state, theme);
	const bounds = unionRects([layout.bounds, primitiveBounds(primitives)]);
	const pending = tasks.length ? Promise.allSettled(tasks).then(() => void 0) : void 0;
	return {
		theme,
		layout,
		primitives,
		bounds,
		contexts,
		state,
		...pending && { pending }
	};
}
/**
* Render, wait for content that was measured with a placeholder, and render again, until
* everything is final (at most `rounds` times). Useful outside a live view, e.g. for
* exporting SVG with images.
*/
async function renderTreeAsync(root, options, rounds = 3) {
	let result = renderTree(root, options);
	for (let i = 1; i < rounds && result.pending; i++) {
		await result.pending;
		result = renderTree(root, options);
	}
	return result;
}
/**
* Draw a state as primitives: edges first, then nodes, each in a keyed group so
* backends can patch them. Edge anchors come from the theme, so animating node rects
* moves edges along with them.
*/
function drawState(state, theme) {
	const underlays = (state.groups ?? []).map((group) => {
		const children = [{
			kind: "rect",
			x: group.rect.x,
			y: group.rect.y,
			w: group.rect.width,
			h: group.rect.height,
			r: 8,
			fill: "var(--mm-group-fill)",
			stroke: "var(--mm-group-border)",
			strokeWidth: 1.5,
			strokeDashArray: [5, 4]
		}];
		if (group.label) children.push({
			kind: "text",
			x: group.rect.x + 8,
			y: group.rect.y - 6,
			runs: [{
				text: group.label,
				x: 0,
				y: 0,
				font: {
					family: theme.font.family,
					size: 12,
					weight: 600,
					style: "normal",
					lineHeight: 14
				},
				fill: "var(--mm-text)"
			}]
		});
		return {
			kind: "group",
			key: `group:${group.id}`,
			groupId: group.id,
			bounds: expandRect(group.rect, BOUNDS_MARGIN),
			children
		};
	});
	const byId = new Map(state.nodes.map((item) => [item.node.id, item]));
	const looks = /* @__PURE__ */ new Map();
	const lookOf = (item) => {
		if (item.presence >= 1) return {};
		let look = looks.get(item.node.id);
		if (!look) {
			const box = {
				width: item.rect.width,
				height: item.rect.height
			};
			look = theme.node.presence?.(item.presence, box, item.ctx) ?? { opacity: item.presence };
			looks.set(item.node.id, look);
		}
		return look;
	};
	const edges = [];
	for (const target of state.nodes) {
		const source = target.parentId ? byId.get(target.parentId) : void 0;
		if (!source) continue;
		const from = theme.node.anchor(source.rect, target.ctx.direction, source.ctx);
		const to = theme.node.anchor(target.rect, oppositeSide(target.ctx.direction), target.ctx);
		edges.push({
			kind: "group",
			key: `edge:${target.node.id}`,
			nodeId: target.node.id,
			bounds: edgeBounds(from, to),
			...opacityOf(lookOf(target)),
			children: theme.edge.render(from, to, {
				source: source.node,
				target: target.node,
				node: target.ctx
			})
		});
	}
	const nodes = state.nodes.map((item) => {
		const [top, , , left] = item.label?.padding ?? theme.node.padding;
		return {
			kind: "group",
			key: `node:${item.node.id}`,
			nodeId: item.node.id,
			bounds: expandRect(item.rect, BOUNDS_MARGIN),
			transform: lookOf(item).transform ? multiply(translate(item.rect.x, item.rect.y), lookOf(item).transform) : translate(item.rect.x, item.rect.y),
			...opacityOf(lookOf(item)),
			children: [...theme.node.render(item.node, {
				width: item.rect.width,
				height: item.rect.height
			}, item.ctx), {
				kind: "group",
				transform: translate(left, top),
				children: item.text.primitives
			}]
		};
	});
	const relations = state.relations ? renderRelationEdges({
		edges: state.relations,
		identities: state.identities,
		nodesById: byId,
		rootId: state.rootId,
		folded: state.folded,
		theme
	}) : [];
	return [
		...underlays,
		...edges,
		...nodes,
		...relations
	];
}
/** Room around a node or edge for what themes draw past it, such as fold circles. */
var BOUNDS_MARGIN = 24;
var edgeBounds = (a, b) => expandRect({
	x: Math.min(a.x, b.x),
	y: Math.min(a.y, b.y),
	width: Math.abs(a.x - b.x),
	height: Math.abs(a.y - b.y)
}, BOUNDS_MARGIN);
var opacityOf = ({ opacity }) => opacity != null && opacity < 1 ? { opacity: Math.max(0, opacity) } : {};
/** Absolute points of a path made of `M`, `L`, `H`, `V` and `C` commands. */
function pathPoints(d) {
	const points = [];
	let [x, y] = [0, 0];
	for (const [, cmd, args] of d.matchAll(/([MLHVC])([^MLHVC]*)/g)) {
		const values = args.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
		if (cmd === "H") for (const v of values) points.push([x = v, y]);
		else if (cmd === "V") for (const v of values) points.push([x, y = v]);
		else for (let i = 0; i + 1 < values.length; i += 2) points.push([x = values[i], y = values[i + 1]]);
	}
	return points;
}
/**
* Bounding box of rects, paths and images, including stroke widths. Curve control
* points are included, so curves give a safe over-estimate. Text is not included:
* it sits inside node boxes, which callers add from the layout.
*/
function primitiveBounds(primitives) {
	const rects = [];
	/** Add a box around a point, whose stroke scales with the matrix. */
	const addPoint = ([a, b, c, d, e, f], x, y, size) => {
		const s = size * Math.max(Math.hypot(a, b), Math.hypot(c, d));
		rects.push({
			x: a * x + c * y + e - s,
			y: b * x + d * y + f - s,
			width: 2 * s,
			height: 2 * s
		});
	};
	const addBox = (matrix, { x, y, width, height }, size) => {
		addPoint(matrix, x, y, size);
		addPoint(matrix, x + width, y, size);
		addPoint(matrix, x, y + height, size);
		addPoint(matrix, x + width, y + height, size);
	};
	const visit = (items, outer) => {
		for (const p of items) if (p.kind === "group") {
			const matrix = p.transform ? multiply(outer, p.transform) : outer;
			if (p.clip) addBox(matrix, p.clip, 0);
			else visit(p.children, matrix);
		} else if (p.kind === "rect" || p.kind === "image") {
			const box = {
				x: p.x,
				y: p.y,
				width: p.w,
				height: p.h
			};
			addBox(outer, box, p.kind === "rect" ? strokeOf(p) : 0);
		} else if (p.kind === "text") for (const run of p.runs) {
			const width = run.width ?? run.text.length * run.font.size * .6;
			const box = {
				x: p.x + run.x,
				y: p.y + run.y - run.font.size,
				width,
				height: run.font.size
			};
			addBox(outer, box, 0);
		}
		else if (p.kind === "path") {
			const s = strokeOf(p);
			for (const [x, y] of pathPoints(p.d)) addPoint(outer, x, y, s);
		}
	};
	visit(primitives, translate(0, 0));
	return unionRects(rects);
}
function strokeOf(p) {
	return p.stroke ? (p.strokeWidth ?? 1) / 2 : 0;
}
// src/svg.ts
var ESCAPES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
};
function escapeXml(value) {
	return value.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}
var num = (value) => String(Math.round(value * 100) / 100);
function attrs(values) {
	let result = "";
	for (const [name, value] of Object.entries(values)) {
		if (value == null || value === "") continue;
		result += ` ${name}="${escapeXml(typeof value === "number" ? num(value) : value)}"`;
	}
	return result;
}
function style(values) {
	const parts = Object.entries(values).filter(([, value]) => value != null).map(([name, value]) => `${name}:${typeof value === "number" ? num(value) : value}`);
	return parts.length ? parts.join(";") : void 0;
}
/** Paints live in `style`, because `var()` is not reliable in presentation attributes. */
function paint(p) {
	return style({
		fill: p.fill ?? "none",
		stroke: p.stroke,
		"stroke-width": p.stroke ? p.strokeWidth : void 0,
		"stroke-dasharray": p.stroke && p.strokeDashArray?.length ? p.strokeDashArray.join(" ") : void 0
	});
}
function runToSVG(run) {
	const { font } = run;
	return `<tspan${attrs({
		x: run.x,
		y: run.y,
		style: style({
			"font-family": font.family,
			"font-size": `${num(font.size)}px`,
			"font-weight": font.weight,
			"font-style": font.style === "italic" ? "italic" : void 0,
			fill: run.fill
		})
	})}>${escapeXml(run.text)}</tspan>`;
}
/** Markup per primitive list, so unchanged content is not serialized on every frame. */
var markupCache = {
	plain: /* @__PURE__ */ new WeakMap(),
	interactive: /* @__PURE__ */ new WeakMap()
};
/**
* Serialize primitives as SVG markup. Primitive lists are treated as immutable: the
* markup of each list is cached, which makes redrawing animation frames cheap.
*/
function primitivesToSVG(primitives, options = {}) {
	const cache = options.interactive ? markupCache.interactive : markupCache.plain;
	let out = cache.get(primitives);
	if (out == null) {
		out = serialize(primitives, options);
		cache.set(primitives, out);
	}
	return out;
}
function serialize(primitives, options) {
	let out = "";
	for (const p of primitives) {
		if (p.backends && !p.backends.includes("svg")) continue;
		switch (p.kind) {
			case "group": {
				const content = primitivesToSVG(p.children, options);
				out += `<g${attrs({
					transform: p.transform && `matrix(${p.transform.map(num).join(" ")})`,
					opacity: p.opacity,
					"data-node-id": p.nodeId,
					"data-group-id": p.groupId
				})}>${p.clip ? clipped(content, p.clip) : content}</g>`;
				break;
			}
			case "rect":
				out += `<rect${attrs({
					x: p.x,
					y: p.y,
					width: p.w,
					height: p.h,
					rx: p.r,
					style: paint(p)
				})}/>`;
				break;
			case "path":
				out += `<path${attrs({
					d: p.d,
					style: paint(p)
				})}/>`;
				break;
			case "text":
				out += `<text${attrs({
					transform: `translate(${num(p.x)} ${num(p.y)})`,
					"xml:space": "preserve"
				})}>${p.runs.map(runToSVG).join("")}</text>`;
				break;
			case "image":
				out += `<image${attrs({
					x: p.x,
					y: p.y,
					width: p.w,
					height: p.h,
					href: p.src
				})}/>`;
				break;
			case "link":
				out += `<a${attrs({
					href: p.href,
					target: "_blank"
				})}><rect${attrs({
					x: p.rect.x,
					y: p.rect.y,
					width: p.rect.width,
					height: p.rect.height,
					style: "fill:transparent"
				})}/></a>`;
				break;
			case "custom":
				out += p.svg?.() ?? "";
				break;
			case "hit": if (options.interactive) out += `<rect${attrs({
				x: p.rect.x,
				y: p.rect.y,
				width: p.rect.width,
				height: p.rect.height,
				"data-action": p.action,
				style: "fill:transparent;cursor:pointer"
			})}/>`;
		}
	}
	return out;
}
/** A nested `<svg>` hides what overflows it, without needing an id like `<clipPath>`. */
function clipped(content, { x, y, width, height }) {
	return `<svg${attrs({
		x,
		y,
		width,
		height,
		viewBox: [
			x,
			y,
			width,
			height
		].map(num).join(" ")
	})}>${content}</svg>`;
}
/** Theme tokens as CSS custom property declarations. */
function tokensToCSS(theme) {
	const tokens = isTheme(theme) ? theme.tokens : theme;
	return Object.entries(tokens).filter(([name, value]) => /^[\w-]+$/.test(name) && isSafeCSSValue(value)).map(([name, value]) => `--${name}:${value};`).join("");
}
var isTheme = (value) => typeof value.tokens === "object";
/**
* Rules that set a theme's tokens on `selector`. Dark tokens override light ones for
* `dark`, and inside a `prefers-color-scheme: dark` query for `auto`.
*/
function themeCSS(theme, colorScheme = "light", selector = ".markmap") {
	const light = `${selector}{${tokensToCSS(theme.tokens)}}`;
	if (!theme.darkTokens || colorScheme === "light") return light;
	const dark = `${selector}{${tokensToCSS(theme.darkTokens)}}`;
	return colorScheme === "dark" ? light + dark : `${light}@media (prefers-color-scheme: dark){${dark}}`;
}
/** A standalone SVG document. Theme tokens are embedded so user CSS can still override them. */
function toSVGString(result, options = {}) {
	const { padding = 20, background = true, colorScheme } = options;
	const box = expandRect(result.bounds, padding);
	const viewBox = [
		box.x,
		box.y,
		box.width,
		box.height
	].map(num).join(" ");
	const css = themeCSS(result.theme, colorScheme);
	const bg = background ? `<rect${attrs({
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		style: "fill:var(--mm-bg)"
	})}/>` : "";
	return `<svg xmlns="http://www.w3.org/2000/svg" class="markmap"${attrs({
		width: box.width,
		height: box.height,
		viewBox
	})}><style>${css}</style>${bg}${primitivesToSVG(result.primitives)}</svg>`;
}
// src/animate.ts
var easeCubicInOut = (t) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
var lerp = (a, b, t) => a + (b - a) * t;
var lerpRect = (a, b, t) => ({
	x: lerp(a.x, b.x, t),
	y: lerp(a.y, b.y, t),
	width: lerp(a.width, b.width, t),
	height: lerp(a.height, b.height, t)
});
/** The closest ancestor of `item` (by its id path) that exists in `byId`. */
function nearestAncestor(item, byId) {
	const { path } = item.ctx;
	for (let i = path.length - 2; i >= 0; i--) {
		const found = byId.get(path[i]);
		if (found) return found;
	}
}
/**
* The default {@link Layout.interpolate}: nodes in both frames move in a straight line;
* entering nodes grow out of their nearest ancestor's anchor (on the side they grow
* towards) and leaving nodes shrink back into their nearest surviving ancestor's.
*/
function interpolateFrames(from, to, t, ctx) {
	const fromById = new Map(from.nodes.map((item) => [item.node.id, item]));
	const toById = new Map(to.nodes.map((item) => [item.node.id, item]));
	/** A rect of `item`'s size whose incoming anchor sits on `ancestor`'s outgoing one. */
	const collapsedInto = (item, ancestor) => {
		const side = item.ctx.direction;
		const point = ctx.anchor(ancestor, side);
		const offset = ctx.anchor({
			...item,
			rect: {
				...item.rect,
				x: 0,
				y: 0
			}
		}, oppositeSide(side));
		return {
			...item.rect,
			x: point.x - offset.x,
			y: point.y - offset.y
		};
	};
	const nodes = to.nodes.map((item) => {
		const old = fromById.get(item.node.id);
		if (old) return {
			...item,
			rect: lerpRect(old.rect, item.rect, t),
			presence: lerp(old.presence, item.presence, t)
		};
		const ancestor = nearestAncestor(item, fromById);
		const start = ancestor ? collapsedInto(item, ancestor) : item.rect;
		return {
			...item,
			rect: lerpRect(start, item.rect, t),
			presence: item.presence * t
		};
	});
	for (const item of from.nodes) {
		if (toById.has(item.node.id)) continue;
		const ancestor = nearestAncestor(item, toById);
		const end = ancestor ? collapsedInto(item, ancestor) : item.rect;
		nodes.push({
			...item,
			rect: lerpRect(item.rect, end, t),
			presence: item.presence * (1 - t)
		});
	}
	return { nodes };
}
/** Interpolate draw states with the layout's own interpolation, or the default one. */
function interpolateStates(from, to, t, theme, layout) {
	const frame = (layout?.interpolate ?? interpolateFrames)(from, to, t, { anchor: (item, side) => theme.node.anchor(item.rect, side, item.ctx) });
	const fromGroups = new Map((from.groups ?? []).map((g) => [g.id, g]));
	const groups = (to.groups ?? []).map((g) => {
		const old = fromGroups.get(g.id);
		return old ? {
			...g,
			rect: lerpRect(old.rect, g.rect, t)
		} : g;
	});
	return {
		...frame,
		groups,
		rootId: to.rootId,
		relations: to.relations,
		identities: to.identities,
		folded: to.folded
	};
}
export { DEFAULT_COLORS, approximateMeasurer, basicContent, branchColors, branchIndex, builtinLayouts, builtinThemes, cardsTheme, classicTheme, computeRelationCurve, configureTheme, createCanvasMeasurer, createCardsTheme, createClassicTheme, createImageContent, createSoftTheme, defaultContentPlugins, drawState, easeCubicInOut, escapeXml, fontToCss, imageContent, interpolateFrames, interpolateStates, layoutOrgChart, layoutText, layoutTree, layoutTwoSided, measureTree, minimalTheme, nodePaths, noteContent, orgChartLayout, primitiveBounds, primitivesToSVG, renderRelationEdges, renderTree, renderTreeAsync, resolvePaint, resolveRenderOptions, sanitizeImageUrl, sanitizeUrl, sideVector, softTheme, splitBranches, themeCSS, themeTokens, toSVGString, tokensToCSS, transformContent, treeLayout, twoSidedLayout, visibleNodes };
