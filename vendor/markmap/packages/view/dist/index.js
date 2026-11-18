import { select } from "d3-selection";
import { findNode, multiply } from "@markmap/core";
import Flatbush from "flatbush";
import { classicTheme, createCanvasMeasurer, defaultContentPlugins, drawState, easeCubicInOut, interpolateStates, primitivesToSVG, renderTree, resolveRenderOptions, themeCSS } from "@markmap/render";
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
// src/gestures.ts
/** Several sets of gestures as one. */
function combineGestures(...list) {
	return (mm) => {
		const stops = list.map((gestures) => gestures(mm));
		return () => {
			for (const stop of stops) stop();
		};
	};
}
/** Zoom with the wheel or pinch and pan by dragging, as the `zoom` and `pan` options allow. */
var panZoomGestures = (mm) => {
	const selection = select(mm.element);
	mm.zoomBehavior.filter((event) => {
		if (event.type === "wheel") return !!mm.options.zoom;
		if (event.type === "dblclick") return false;
		const { button = 0, ctrlKey = false } = event;
		return !!mm.options.pan && !ctrlKey && !button;
	});
	selection.call(mm.zoomBehavior);
	return () => {
		selection.on(".zoom", null);
	};
};
/**
* Click a fold anchor to toggle it, or with Ctrl or Cmd to toggle everything below it too.
* Click a note dot to show its notes. Links open themselves on backends that draw them.
*/
var pointerGestures = (mm) => {
	const element = mm.element;
	const targetOf = ({ clientX, clientY }) => mm.hitAt(...mm.layoutPoint(clientX, clientY));
	const handleClick = (event) => {
		if (event.defaultPrevented) return;
		const mouse = event;
		const target = targetOf(mouse);
		if (target?.kind === "action" && target.action === "notes") {
			if (target.nodeId === mm.openNoteId) mm.closeNotes();
			else mm.openNotes(target.nodeId);
		} else if (target?.kind === "link") {
			if (!mm.backend.nativeLinks) element.ownerDocument.defaultView?.open(target.href, "_blank", "noopener,noreferrer");
		} else if (target?.kind === "toggle") {
			if (!mouse.ctrlKey && !mouse.metaKey) mm.toggle(target.nodeId);
			else if (mm.foldedIds.has(target.nodeId)) mm.expandAll(target.nodeId);
			else mm.foldAll(target.nodeId);
		}
	};
	/** Show that a target is clickable, whatever the backend draws it with. */
	const handleHover = (event) => {
		const pointer = event;
		if (pointer.buttons) return;
		const target = targetOf(pointer);
		element.style.cursor = target && target.kind !== "node" ? "pointer" : "";
	};
	element.addEventListener("click", handleClick);
	element.addEventListener("pointermove", handleHover);
	return () => {
		element.removeEventListener("click", handleClick);
		element.removeEventListener("pointermove", handleHover);
		element.style.cursor = "";
	};
};
/** What a map uses unless the `gestures` option says otherwise. */
var defaultGestures = combineGestures(panZoomGestures, pointerGestures);
// src/hit-index.ts
var IDENTITY = [
	1,
	0,
	0,
	1,
	0,
	0
];
/**
* Everything clickable in a drawing, in layout coordinates, for any backend. `hit` and
* `link` primitives are found by walking the primitives (with their group transforms),
* fold toggles are given as points. Lookups use a static R-tree, so they stay fast for
* large maps.
*/
var HitIndex = class {
	entries = [];
	index;
	radius;
	constructor(primitives, options = {}) {
		const include = options.include ?? (() => true);
		const radius = this.radius = options.toggleRadius ?? 10;
		const boxes = [];
		const add = (target, box, center) => {
			this.entries.push({
				target,
				center
			});
			boxes.push(box);
		};
		const visit = (list, matrix, nodeId) => {
			for (const p of list) if (p.kind === "group") {
				if (p.groupId && p.bounds) add({
					kind: "group",
					groupId: p.groupId
				}, transformRect(matrix, p.bounds));
				const id = p.nodeId ?? nodeId;
				if (id && !include(id)) continue;
				visit(p.children, p.transform ? multiply(matrix, p.transform) : matrix, id);
			} else if (p.kind === "hit" && nodeId) add({
				kind: "action",
				nodeId,
				action: p.action
			}, transformRect(matrix, p.rect));
			else if (p.kind === "link") add({
				kind: "link",
				nodeId,
				href: p.href
			}, transformRect(matrix, p.rect));
		};
		visit(primitives, IDENTITY);
		for (const { x, y, nodeId } of options.toggles ?? []) {
			if (!include(nodeId)) continue;
			add({
				kind: "toggle",
				nodeId
			}, {
				x: x - radius,
				y: y - radius,
				width: radius * 2,
				height: radius * 2
			}, {
				x,
				y
			});
		}
		for (const { nodeId, rect } of options.nodes ?? []) if (include(nodeId)) add({
			kind: "node",
			nodeId
		}, rect);
		for (const { groupId, rect } of options.groups ?? []) add({
			kind: "group",
			groupId
		}, rect);
		if (!boxes.length) return;
		this.index = new Flatbush(boxes.length);
		for (const box of boxes) this.index.add(box.x, box.y, box.x + box.width, box.y + box.height);
		this.index.finish();
	}
	/**
	* The target at a point in layout coordinates. Actions and links win over fold
	* toggles, and the one drawn last (on top) wins among them; among toggles, the nearest.
	* A node's box only counts if none of those is there.
	*/
	hit(x, y) {
		if (!this.index) return void 0;
		let top = -1;
		let node = -1;
		let group = -1;
		let toggle;
		for (const i of this.index.search(x, y, x, y)) {
			const { center, target } = this.entries[i];
			if (target.kind === "group") {
				group = Math.max(group, i);
				continue;
			}
			if (target.kind === "node") {
				node = Math.max(node, i);
				continue;
			}
			if (!center) {
				top = Math.max(top, i);
				continue;
			}
			const distance = Math.hypot(center.x - x, center.y - y);
			if (distance <= this.radius && (!toggle || distance < toggle.distance)) toggle = {
				index: i,
				distance
			};
		}
		const found = top >= 0 ? top : toggle?.index ?? (node >= 0 ? node : group);
		return found < 0 ? void 0 : this.entries[found].target;
	}
};
/** Bounds of `rect` after `matrix`. */
function transformRect([a, b, c, d, e, f], rect) {
	const xs = [];
	const ys = [];
	for (const [x, y] of [
		[rect.x, rect.y],
		[rect.x + rect.width, rect.y],
		[rect.x, rect.y + rect.height],
		[rect.x + rect.width, rect.y + rect.height]
	]) {
		xs.push(a * x + c * y + e);
		ys.push(b * x + d * y + f);
	}
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return {
		x,
		y,
		width: Math.max(...xs) - x,
		height: Math.max(...ys) - y
	};
}
// src/popover.ts
var STYLE_ID = "markmap-popover-style";
var CSS = `
.markmap-popover {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  max-width: min(420px, calc(100vw - 16px));
  max-height: min(50vh, 480px);
  overflow: auto;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  background: var(--mm-bg, #fff);
  color: var(--mm-text, #333);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
/* Focused programmatically so Escape and screen readers land here; no ring needed. */
.markmap-popover:focus { outline: none; }
.markmap-popover > :first-child { margin-top: 0; }
.markmap-popover > :last-child { margin-bottom: 0; }
.markmap-popover p, .markmap-popover pre, .markmap-popover blockquote,
.markmap-popover table, .markmap-popover ul, .markmap-popover ol { margin: 0.5em 0; }
.markmap-popover a { color: var(--mm-link, #0097e6); }
.markmap-popover code {
  padding: 0.1em 0.3em;
  border-radius: 3px;
  background: var(--mm-code-bg, #f0f0f0);
  color: var(--mm-code-text, #555);
  font: 0.9em ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.markmap-popover pre { padding: 8px; overflow: auto; border-radius: 4px; background: var(--mm-code-bg, #f0f0f0); }
.markmap-popover pre code { padding: 0; background: none; }
.markmap-popover blockquote { padding-left: 0.8em; border-left: 3px solid rgba(0, 0, 0, 0.15); color: inherit; opacity: 0.85; }
.markmap-popover table { border-collapse: collapse; }
.markmap-popover th, .markmap-popover td { padding: 2px 8px; border: 1px solid rgba(0, 0, 0, 0.15); }
.markmap-popover mark { background: var(--mm-mark-bg, #ffeaa7); color: inherit; }
.markmap-popover img { max-width: 100%; }
.markmap-popover .hljs-keyword, .markmap-popover .hljs-type, .markmap-popover .hljs-meta .hljs-keyword,
.markmap-popover .hljs-selector-tag, .markmap-popover .hljs-doctag { color: var(--mm-syntax-keyword, #cf222e); }
.markmap-popover .hljs-string, .markmap-popover .hljs-regexp, .markmap-popover .hljs-char,
.markmap-popover .hljs-meta .hljs-string { color: var(--mm-syntax-string, #0a3069); }
.markmap-popover .hljs-comment, .markmap-popover .hljs-quote { color: var(--mm-syntax-comment, #6e7781); font-style: italic; }
.markmap-popover .hljs-number, .markmap-popover .hljs-literal, .markmap-popover .hljs-symbol,
.markmap-popover .hljs-variable.constant_, .markmap-popover .hljs-built_in { color: var(--mm-syntax-number, #0550ae); }
.markmap-popover .hljs-title, .markmap-popover .hljs-section { color: var(--mm-syntax-title, #8250df); }
.markmap-popover .hljs-attr, .markmap-popover .hljs-attribute, .markmap-popover .hljs-property,
.markmap-popover .hljs-name, .markmap-popover .hljs-selector-class { color: var(--mm-syntax-attr, #116329); }
`;
function ensureStyle(doc) {
	if (doc.getElementById(STYLE_ID)) return;
	const style = doc.createElement("style");
	style.id = STYLE_ID;
	style.textContent = CSS;
	doc.head.append(style);
}
var GAP = 6;
var MARGIN = 8;
/** A floating panel next to a node, outside the SVG so it does not scale with zoom. */
var Popover = class {
	el;
	constructor(doc, html, tokens) {
		ensureStyle(doc);
		this.el = doc.createElement("div");
		this.el.className = "markmap-popover";
		this.el.setAttribute("role", "dialog");
		this.el.tabIndex = -1;
		for (const [name, value] of Object.entries(tokens)) this.el.style.setProperty(`--${name}`, value);
		this.el.innerHTML = html;
		doc.body.append(this.el);
	}
	/** Place below `anchor` (a rect in viewport coordinates), or above when there is no room. */
	position(anchor) {
		const view = this.el.ownerDocument.defaultView;
		const vw = view?.innerWidth ?? 0;
		const vh = view?.innerHeight ?? 0;
		const { width, height } = this.el.getBoundingClientRect();
		const below = anchor.y + anchor.height + GAP;
		const above = anchor.y - GAP - height;
		const top = below + height <= vh - MARGIN || above < MARGIN ? below : above;
		const left = Math.min(Math.max(MARGIN, anchor.x), Math.max(MARGIN, vw - width - MARGIN));
		this.el.style.top = `${Math.round(top)}px`;
		this.el.style.left = `${Math.round(left)}px`;
	}
	contains(node) {
		return !!node && this.el.contains(node);
	}
	destroy() {
		this.el.remove();
	}
};
// src/svg-backend.ts
var SVG_NS = "http://www.w3.org/2000/svg";
/**
* Draws primitives into an SVG element. Top-level groups with a `key` keep their
* element between draws, so only changed transforms and contents touch the DOM.
*/
var SvgDomBackend = class {
	element;
	nativeLinks = true;
	themeSelector;
	/** Group that holds the drawing and carries the zoom transform. */
	root;
	style;
	items = /* @__PURE__ */ new Map();
	constructor(svg, { themeSelector } = {}) {
		this.element = svg;
		this.themeSelector = themeSelector;
		const doc = svg.ownerDocument;
		this.style = doc.createElementNS(SVG_NS, "style");
		this.root = doc.createElementNS(SVG_NS, "g");
		svg.append(this.style, this.root);
	}
	setCSS(css) {
		this.style.textContent = css;
	}
	setTransform({ k, x, y }) {
		this.root.setAttribute("transform", `translate(${x},${y}) scale(${k})`);
	}
	/** Element drawn for a keyed group, if any. */
	get(key) {
		return this.items.get(key)?.el;
	}
	draw(primitives) {
		const seen = /* @__PURE__ */ new Set();
		let prev = null;
		primitives.forEach((p, index) => {
			if (p.backends && !p.backends.includes("svg")) return;
			const isGroup = p.kind === "group";
			const key = isGroup && p.key ? p.key : `#${index}`;
			seen.add(key);
			let item = this.items.get(key);
			if (!item) {
				item = {
					el: this.root.ownerDocument.createElementNS(SVG_NS, "g"),
					markup: ""
				};
				this.items.set(key, item);
			}
			const { el } = item;
			setAttr(el, "transform", isGroup && p.transform ? `matrix(${p.transform.join(" ")})` : null);
			setAttr(el, "opacity", isGroup && p.opacity != null ? String(p.opacity) : null);
			setAttr(el, "data-node-id", isGroup ? p.nodeId ?? null : null);
			setAttr(el, "data-group-id", isGroup ? p.groupId ?? null : null);
			setAttr(el, "data-key", key);
			const content = !isGroup ? [p] : p.clip ? [{
				...p,
				transform: void 0,
				opacity: void 0
			}] : p.children;
			const markup = primitivesToSVG(content, { interactive: true });
			if (markup !== item.markup) {
				if (!patchPath(el, item.markup, markup)) el.innerHTML = markup;
				item.markup = markup;
			}
			const expected = prev ? prev.nextSibling : this.root.firstChild;
			if (expected !== el) this.root.insertBefore(el, expected);
			prev = el;
		});
		for (const [key, item] of this.items) if (!seen.has(key)) {
			item.el.remove();
			this.items.delete(key);
		}
	}
	destroy() {
		this.style.remove();
		this.root.remove();
		this.items.clear();
	}
};
function setAttr(el, name, value) {
	if (value == null) el.removeAttribute(name);
	else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
var SINGLE_PATH = /^<path d="([^"]*)"([^>]*)\/>$/;
/** If both markups are one path that differs only in `d`, set `d` and return true. */
function patchPath(el, before, after) {
	const a = SINGLE_PATH.exec(before);
	const b = SINGLE_PATH.exec(after);
	const path = el.firstElementChild;
	if (!a || !b || a[2] !== b[2] || b[1].includes("&")) return false;
	if (!path || path !== el.lastElementChild) return false;
	path.setAttribute("d", b[1]);
	return true;
}
// src/tween.ts
var animationFrames = {
	now: () => performance.now(),
	request: (callback) => requestAnimationFrame(callback),
	cancel: (handle) => cancelAnimationFrame(handle)
};
/**
* Runs one animation at a time: starting a new one stops the previous one, so callers
* restart from whatever they last drew.
*/
var Tween = class {
	scheduler;
	handle;
	constructor(scheduler = animationFrames) {
		this.scheduler = scheduler;
	}
	get running() {
		return this.handle != null;
	}
	/**
	* Call `frame` with progress from 0 to 1 on every animation frame for `duration` ms.
	* The last call is always exactly 1. A duration of 0 calls `frame(1)` right away.
	*/
	start(duration, frame) {
		this.stop();
		if (duration <= 0) {
			frame(1);
			return;
		}
		const start = this.scheduler.now();
		const tick = () => {
			const t = Math.min(1, (this.scheduler.now() - start) / duration);
			this.handle = t < 1 ? this.scheduler.request(tick) : void 0;
			frame(t);
		};
		this.handle = this.scheduler.request(tick);
	}
	stop() {
		if (this.handle == null) return;
		this.scheduler.cancel(this.handle);
		this.handle = void 0;
	}
};
// src/markmap.ts
var DEFAULTS = {
	zoom: true,
	pan: true,
	fitPadding: 20,
	fitMaxScale: 2,
	minScale: .1,
	maxScale: 8,
	duration: 500
};
/**
* Validate untrusted Markdown options (usually `frontmatter.markmap`) and apply them on
* top of `base`, including the theme's own options. Ignored values come back as warnings.
*/
function resolveViewOptions(base, input, resolve) {
	const { options, json, warnings } = resolveRenderOptions(base, input, resolve);
	for (const key of [
		"zoom",
		"pan",
		"fitPadding",
		"fitMaxScale",
		"minScale",
		"maxScale",
		"foldLevel",
		"duration",
		"colorScheme"
	]) if (json[key] != null) options[key] = json[key];
	return {
		options,
		warnings
	};
}
/** Scale change of one `zoomIn()` or `zoomOut()` step. */
var ZOOM_STEP = 1.25;
/** Visit a node and its descendants, depth-first. `depth` counts from `node` (0). */
function walk(node, visit, depth = 0) {
	visit(node, depth);
	for (const child of node.children) walk(child, visit, depth + 1);
}
/** How close to a node's fold anchor a click must be to toggle it, in px. */
var TOGGLE_RADIUS = 10;
/** A class of its own for a map's theme CSS, so maps on one page keep their themes apart. */
var uniqueClass = () => `markmap-${Math.random().toString(36).slice(2, 10)}`;
/** The nodes from `node` down to the one with `id`, or `undefined` if it is not there. */
function pathTo(node, id) {
	if (node.id === id) return [node];
	for (const child of node.children) {
		const path = pathTo(child, id);
		if (path) return [node, ...path];
	}
}
var isBackend = (value) => typeof value.draw === "function";
var Markmap = class Markmap {
	backend;
	scopeClass = uniqueClass();
	viewOptions = DEFAULTS;
	/** The d3 zoom behavior, for gestures to connect to the element. */
	zoomBehavior = zoom();
	gestures;
	selection;
	measurer;
	root;
	folded = /* @__PURE__ */ new Set();
	known = /* @__PURE__ */ new Set();
	current;
	pendingFit;
	popover;
	/** Bumped on every open/close, so a slow lazy import cannot open a stale popover. */
	popoverRequest = 0;
	/** What is on screen: the final state, or a frame of an animation towards it. */
	frame;
	/** Primitives drawn for `frame`. */
	primitives = [];
	/** Hit targets of `frame`, built on the first lookup after it is drawn. */
	hits;
	stateTween = new Tween();
	zoomTween = new Tween();
	/** Whether the first fit has happened; it is never animated. */
	placed = false;
	/** Scale of the last fit. */
	fitScale;
	/** Where the running zoom animation ends. */
	zoomTarget;
	/**
	* A node held at a fixed point in the element (its top-left corner) while the tree moves
	* around it, as when folding. Applied on every frame, so it works however the
	* frames move the node, and released when the animation ends or the user moves the view.
	*/
	pin;
	/**
	* Show a map in an `<svg>` element, or through another backend (such as canvas from
	* `@markmap/canvas`).
	*/
	constructor(target, options = {}) {
		this.backend = isBackend(target) ? target : new SvgDomBackend(target);
		const { element } = this.backend;
		element.classList.add("markmap", this.scopeClass);
		this.measurer = options.measurer ?? createCanvasMeasurer();
		this.applyOptions(options);
		this.selection = select(element);
		this.zoomBehavior.on("zoom", (event) => {
			if (event.sourceEvent) {
				this.zoomTween.stop();
				this.pin = void 0;
			}
			this.backend.setTransform(event.transform);
			this.positionPopover();
			this.emit("zoom", event.transform);
		});
		this.applyGestures();
	}
	/** Connect the `gestures` option, replacing the previous ones if it changed. */
	applyGestures() {
		const use = this.options.gestures ?? defaultGestures;
		if (this.gestures?.use === use) return;
		this.gestures?.stop?.();
		this.gestures = {
			use,
			stop: use ? use(this) : void 0
		};
	}
	/** Keep the last fit within the limits, or zooming from it would jump. */
	updateScaleLimits() {
		const { minScale = 0, maxScale = Infinity } = this.viewOptions;
		const fit = this.fitScale ?? minScale;
		this.zoomBehavior.scaleExtent([Math.min(minScale, fit), Math.max(maxScale, fit)]);
	}
	/** The smallest and largest scale the view can zoom to. */
	get scaleLimits() {
		const [min, max] = this.zoomBehavior.scaleExtent();
		return [min, max];
	}
	/**
	* Class that carries the map's theme tokens: add it to controls beside the map so they
	* can use `--mm-*` too.
	*/
	get themeClass() {
		return this.scopeClass;
	}
	/** The tree on show, with folded nodes. */
	get tree() {
		return this.root;
	}
	/** The element the map is shown in. */
	get element() {
		return this.backend.element;
	}
	get options() {
		return this.viewOptions;
	}
	/** Replace all options (defaults fill the gaps) and redraw. */
	setOptions(options) {
		this.applyOptions(options);
		this.render();
	}
	applyOptions(options) {
		this.viewOptions = {
			...DEFAULTS,
			...options
		};
		if (options.measurer) this.measurer = options.measurer;
		const selector = this.backend.themeSelector ?? `.${this.scopeClass}`;
		this.backend.setCSS(themeCSS(this.theme, this.viewOptions.colorScheme, selector));
		this.updateScaleLimits();
		if (this.gestures) this.applyGestures();
	}
	static create(target, root, options) {
		const mm = new Markmap(target, options);
		if (root) {
			mm.setTree(root);
			mm.fit();
		}
		return mm;
	}
	get theme() {
		return this.options.theme ?? classicTheme;
	}
	/** Ids of folded nodes. */
	get foldedIds() {
		return this.folded;
	}
	/** The final (not mid-animation) result of the last render. */
	get result() {
		return this.current;
	}
	setGraph(graph, identities) {
		this.viewOptions.graph = graph;
		this.viewOptions.identities = identities;
	}
	/**
	* Show a new tree, optionally replacing all options at the same time. Fold state is
	* kept for ids that still exist, so live editing does not reset what the user folded.
	* New nodes start folded if `data.fold` or an ancestor's `data.foldAll` is set, or
	* they are below `foldLevel`.
	*/
	setTree(root, options) {
		if (options) this.applyOptions(options);
		this.root = root;
		const ids = /* @__PURE__ */ new Set();
		const level = this.options.foldLevel;
		const visit = (node, depth, foldAll) => {
			ids.add(node.id);
			const all = foldAll || !!node.data.foldAll;
			if (!this.known.has(node.id) && node.children.length) {
				if (all || node.data.fold || level != null && depth >= level) this.folded.add(node.id);
			}
			for (const child of node.children) visit(child, depth + 1, all);
		};
		const before = new Set(this.folded);
		visit(root, 0, false);
		for (const id of this.folded) if (!ids.has(id)) this.folded.delete(id);
		this.known = ids;
		this.render();
		if (!sameSet(before, this.folded)) this.emit("fold", this.folded);
	}
	/** Re-measure, lay out and draw the current tree, animated unless `animate` is `false`. */
	render({ animate = true } = {}) {
		if (!this.root) return void 0;
		this.current = renderTree(this.root, {
			...this.viewOptions,
			measurer: this.measurer,
			folded: this.folded
		});
		const target = this.current.state;
		const from = this.frame;
		const duration = animate ? this.duration : 0;
		if (from && duration > 0) {
			const theme = this.theme;
			const layout = this.options.layout;
			this.stateTween.start(duration, (t) => {
				this.drawFrame(t < 1 ? interpolateStates(from, target, easeCubicInOut(t), theme, layout) : target);
				if (t >= 1) this.pin = void 0;
			});
		} else {
			this.stateTween.stop();
			this.drawFrame(target);
			this.pin = void 0;
		}
		if (this.popover) {
			if (this.current.layout.byId.get(this.popover.id)?.node.notes.length) this.positionPopover();
			else this.closeNotes();
		}
		this.emit("render", this.current);
		const { pending } = this.current;
		if (pending) {
			const result = this.current;
			pending.then(() => {
				if (this.current === result) this.render();
			});
		}
		return this.current;
	}
	drawFrame(state) {
		this.frame = state;
		this.primitives = drawState(state, this.theme);
		this.backend.draw(this.primitives);
		this.applyPin();
		this.positionPopover();
	}
	/** Pan so the pinned node's frame position lands on its pinned point. */
	applyPin() {
		const rect = this.pin && this.frameNode(this.pin.id)?.rect;
		if (!this.pin || !rect) return;
		const { k, x, y } = this.transform;
		const dx = this.pin.x - (x + rect.x * k);
		const dy = this.pin.y - (y + rect.y * k);
		if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;
		this.zoomBehavior.transform(this.selection, zoomIdentity.translate(x + dx, y + dy).scale(k));
	}
	/** Animation length in ms, `0` when animations are off. */
	get duration() {
		if (this.element.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0;
		return this.options.duration ?? 0;
	}
	/** Where a node is drawn right now, possibly mid-animation. */
	frameNode(id) {
		return this.frame?.nodes.find((item) => item.node.id === id);
	}
	/** Fold or unfold a node, keeping it in place on screen. */
	setFolded(id, folded) {
		if (folded === this.folded.has(id)) return;
		this.updateFolded(id, () => {
			if (folded) this.folded.add(id);
			else this.folded.delete(id);
		});
	}
	/**
	* Replace the set of folded nodes, as when restoring a saved state: one redraw, keeping
	* the root still. Ids that no longer exist, and nodes with no children, are ignored.
	*/
	setFoldedIds(ids, { animate = true } = {}) {
		if (!this.root) return;
		const wanted = new Set(ids);
		const update = () => {
			this.folded.clear();
			walk(this.root, (node) => {
				if (wanted.has(node.id) && node.children.length) this.folded.add(node.id);
			});
		};
		this.updateFolded(this.root.id, update, animate);
	}
	/**
	* Unfold a node's ancestors and center on it, as for a link to a node. Keeps the current
	* zoom unless `scale` is given. Returns whether the node exists; a view with no size
	* yet unfolds but cannot center.
	*/
	focusNode(id, options = {}) {
		const path = this.root && pathTo(this.root, id);
		if (!path) return false;
		const { animate = true } = options;
		const hidden = path.slice(0, -1).filter((node) => this.folded.has(node.id));
		if (hidden.length) {
			for (const node of hidden) this.folded.delete(node.id);
			this.render({ animate });
			this.emit("fold", this.folded);
		}
		const rect = this.current?.layout.byId.get(id)?.rect;
		const { width, height } = this.element.getBoundingClientRect();
		if (rect && width && height) {
			const [min, max] = this.zoomBehavior.scaleExtent();
			const k = Math.min(max, Math.max(min, options.scale ?? this.transform.k));
			const x = width / 2 - (rect.x + rect.width / 2) * k;
			const y = height / 2 - (rect.y + rect.height / 2) * k;
			this.zoomTo(zoomIdentity.translate(x, y).scale(k), animate);
		}
		return true;
	}
	/** Unfold a node and everything below it. Defaults to the whole tree. */
	expandAll(id) {
		const node = this.subtree(id);
		if (!node) return;
		this.updateFolded(node.id, () => {
			walk(node, (child) => this.folded.delete(child.id));
		});
	}
	/**
	* Fold a node and every node below it that has children, so unfolding later reveals
	* one level at a time. Defaults to the whole tree, leaving only the root.
	*/
	foldAll(id) {
		const node = this.subtree(id);
		if (!node) return;
		this.updateFolded(node.id, () => {
			walk(node, (child) => {
				if (child.children.length) this.folded.add(child.id);
			});
		});
	}
	/**
	* Show the tree down to `level`: nodes at that depth and deeper are folded, the rest
	* unfolded. The root is depth 0, so `1` shows only the root's children. Same meaning
	* as the `foldLevel` option; `expandAll()` shows everything.
	*/
	foldToLevel(level) {
		if (!this.root) return;
		this.updateFolded(this.root.id, () => {
			walk(this.root, (node, depth) => {
				if (depth >= level && node.children.length) this.folded.add(node.id);
				else this.folded.delete(node.id);
			});
		});
	}
	subtree(id) {
		if (!this.root) return void 0;
		return id == null ? this.root : findNode(this.root, id);
	}
	/**
	* Change fold state and redraw once, animated, keeping `pinId` still on screen. If that
	* node is not drawn (inside a folded branch), the root stays still instead.
	*/
	updateFolded(pinId, change, animate = true) {
		const before = new Set(this.folded);
		change();
		if (sameSet(before, this.folded)) return;
		const pinned = this.frameNode(pinId) ?? (this.root && this.frameNode(this.root.id));
		if (pinned) {
			const [x, y] = this.transform.apply([pinned.rect.x, pinned.rect.y]);
			this.zoomTween.stop();
			this.pin = {
				id: pinned.node.id,
				x,
				y
			};
		}
		this.render({ animate });
		this.emit("fold", this.folded);
	}
	listeners = /* @__PURE__ */ new Map();
	/** Listen to an event. Returns a function that stops listening. */
	on(type, listener) {
		let set = this.listeners.get(type);
		if (!set) this.listeners.set(type, set = /* @__PURE__ */ new Set());
		set.add(listener);
		return () => set.delete(listener);
	}
	emit(type, value) {
		for (const listener of this.listeners.get(type) ?? []) listener(value);
	}
	/**
	* Zoom by `factor` around the center of the element, animated. Repeated calls during an
	* animation add up. The scale stays within the zoom behavior's scale extent.
	*/
	zoomBy(factor) {
		const { width, height } = this.element.getBoundingClientRect();
		const base = this.zoomTween.running && this.zoomTarget || this.transform;
		const [min, max] = this.zoomBehavior.scaleExtent();
		const k = Math.min(max, Math.max(min, base.k * factor));
		const cx = width / 2;
		const cy = height / 2;
		const x = (cx - base.x) / base.k;
		const y = (cy - base.y) / base.k;
		this.zoomTo(zoomIdentity.translate(cx - x * k, cy - y * k).scale(k));
	}
	zoomIn() {
		this.zoomBy(ZOOM_STEP);
	}
	zoomOut() {
		this.zoomBy(1 / ZOOM_STEP);
	}
	/** Move the view to `target`, animated unless animations are off. */
	zoomTo(target, animate = true) {
		this.pin = void 0;
		this.zoomTarget = target;
		const from = this.transform;
		const { width, height } = this.element.getBoundingClientRect();
		const apply = (transform) => this.zoomBehavior.transform(this.selection, transform);
		const duration = animate ? this.duration : 0;
		this.zoomTween.start(duration, (t) => apply(t < 1 ? interpolateZoom(from, target, easeCubicInOut(t), width / 2, height / 2) : target));
	}
	toggle(id) {
		this.setFolded(id, !this.folded.has(id));
	}
	/**
	* Scale and center the drawing to fill the element. If it has no size yet (hidden,
	* or not laid out), the fit happens as soon as it gets one.
	*/
	fit() {
		if (!this.current) return;
		const { width, height } = this.element.getBoundingClientRect();
		if (!width || !height) {
			this.fitWhenSized();
			return;
		}
		this.pendingFit?.disconnect();
		this.pendingFit = void 0;
		const box = this.current.bounds;
		const padding = this.options.fitPadding ?? 0;
		const scale = Math.min((width - padding * 2) / box.width, (height - padding * 2) / box.height, this.options.fitMaxScale ?? 2);
		this.fitScale = scale;
		this.updateScaleLimits();
		const transform = zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-(box.x + box.width / 2), -(box.y + box.height / 2));
		this.zoomTo(transform, this.placed);
		this.placed = true;
	}
	fitWhenSized() {
		if (this.pendingFit || typeof ResizeObserver === "undefined") return;
		this.pendingFit = new ResizeObserver(() => {
			const { width, height } = this.element.getBoundingClientRect();
			if (width && height) this.fit();
		});
		this.pendingFit.observe(this.element);
	}
	/** Current zoom transform. */
	get transform() {
		return zoomTransform(this.element);
	}
	/**
	* What a point in layout coordinates acts on, where things are drawn right now (also
	* mid-animation). Nodes on their way out cannot be clicked.
	*/
	hitAt(x, y) {
		const { frame, result } = this;
		if (!frame || !result) return void 0;
		if (this.hits?.frame !== frame) {
			const toggles = frame.nodes.filter((item) => item.ctx.hasChildren).map((item) => ({
				nodeId: item.node.id,
				...this.theme.node.anchor(item.rect, item.ctx.direction, item.ctx)
			}));
			const index = new HitIndex(this.primitives, {
				toggles,
				toggleRadius: TOGGLE_RADIUS,
				nodes: frame.nodes.map((item) => ({
					nodeId: item.node.id,
					rect: item.rect
				})),
				groups: (frame.groups ?? []).map((item) => ({
					groupId: item.id,
					rect: item.rect
				})),
				include: (id) => result.layout.byId.has(id)
			});
			this.hits = {
				frame,
				index
			};
		}
		return this.hits.index.hit(x, y);
	}
	/** Layout coordinates of a point in the viewport, such as a pointer's position. */
	layoutPoint(clientX, clientY) {
		const box = this.element.getBoundingClientRect();
		return this.transform.invert([clientX - box.x, clientY - box.y]);
	}
	/** Id of the node whose notes are open, if any. */
	get openNoteId() {
		return this.popover?.id;
	}
	/** Show a node's notes in a popover next to it. */
	async openNotes(id) {
		const item = this.current?.layout.byId.get(id);
		if (!item?.node.notes.length) return;
		this.closeNotes();
		const request = this.popoverRequest;
		const { notesToHtml } = await import("./notes-html-DIYxB3aO.js");
		const html = await notesToHtml(item.node.notes, {
			plugins: this.options.plugins ?? defaultContentPlugins,
			highlight: this.options.highlight
		});
		if (request !== this.popoverRequest) return;
		const popover = new Popover(this.element.ownerDocument, html, this.currentTokens());
		popover.el.setAttribute("aria-label", "Notes");
		this.popover = {
			id,
			popover
		};
		this.positionPopover();
		const doc = this.element.ownerDocument;
		doc.addEventListener("click", this.handleOutside, true);
		doc.addEventListener("keydown", this.handleKey);
		doc.defaultView?.addEventListener("scroll", this.handleScroll, true);
		popover.el.focus({ preventScroll: true });
	}
	closeNotes() {
		this.popoverRequest += 1;
		if (!this.popover) return;
		this.popover.popover.destroy();
		this.popover = void 0;
		const doc = this.element.ownerDocument;
		doc.removeEventListener("click", this.handleOutside, true);
		doc.removeEventListener("keydown", this.handleKey);
		doc.defaultView?.removeEventListener("scroll", this.handleScroll, true);
	}
	/**
	* Token values as the element resolves them right now, so the popover matches the color
	* scheme in effect and any CSS overrides on the page.
	*/
	currentTokens() {
		const { tokens, darkTokens = {} } = this.theme;
		const style = this.element.ownerDocument.defaultView?.getComputedStyle(this.element);
		const result = {};
		for (const name of /* @__PURE__ */ new Set([...Object.keys(tokens), ...Object.keys(darkTokens)])) result[name] = style?.getPropertyValue(`--${name}`).trim() || tokens[name] || "";
		return result;
	}
	/** A node's box in viewport coordinates, where it is drawn right now. */
	screenRect(id) {
		const rect = this.frameNode(id)?.rect;
		if (!rect) return void 0;
		const svgRect = this.element.getBoundingClientRect();
		const t = this.transform;
		return {
			x: svgRect.x + t.applyX(rect.x),
			y: svgRect.y + t.applyY(rect.y),
			width: rect.width * t.k,
			height: rect.height * t.k
		};
	}
	setGroups(groups) {
		this.viewOptions = {
			...this.viewOptions,
			groups
		};
		this.render();
	}
	get groups() {
		return this.viewOptions.groups ?? [];
	}
	groupScreenRect(id) {
		const group = this.frame?.groups?.find((g, i) => g.id === String(id) || g.id === `group-${id}` || i === Number(id));
		if (!group) return void 0;
		const svgRect = this.element.getBoundingClientRect();
		const t = this.transform;
		return {
			x: svgRect.x + t.applyX(group.rect.x),
			y: svgRect.y + t.applyY(group.rect.y),
			width: group.rect.width * t.k,
			height: group.rect.height * t.k
		};
	}
	positionPopover() {
		if (!this.popover) return;
		const rect = this.screenRect(this.popover.id);
		if (rect) this.popover.popover.position(rect);
	}
	handleOutside = (event) => {
		const target = event.composedPath()[0];
		if (this.popover?.popover.contains(target)) return;
		if (target && this.element.contains(target) && event instanceof MouseEvent) {
			const hit = this.hitAt(...this.layoutPoint(event.clientX, event.clientY));
			if (hit?.kind === "action" && hit.action === "notes") return;
		}
		this.closeNotes();
	};
	handleKey = (event) => {
		if (event.key === "Escape") this.closeNotes();
	};
	handleScroll = (event) => {
		if (!this.popover?.popover.contains(event.target)) this.closeNotes();
	};
	destroy() {
		this.root = void 0;
		this.listeners.clear();
		this.stateTween.stop();
		this.zoomTween.stop();
		this.closeNotes();
		this.gestures?.stop?.();
		this.gestures = void 0;
		this.pendingFit?.disconnect();
		this.backend.destroy();
		this.element.classList.remove("markmap", this.scopeClass);
	}
};
/**
* A zoom transform `t` of the way from `a` to `b`. The scale changes geometrically and
* the layout point under (`cx`, `cy`) moves in a straight line, so a pure pan moves at a
* constant speed and zooming does not swing sideways.
*/
function interpolateZoom(a, b, t, cx, cy) {
	const k = a.k * (b.k / a.k) ** t;
	const x = (cx - a.x) / a.k * (1 - t) + (cx - b.x) / b.k * t;
	const y = (cy - a.y) / a.k * (1 - t) + (cy - b.y) / b.k * t;
	return zoomIdentity.translate(cx - x * k, cy - y * k).scale(k);
}
function sameSet(a, b) {
	return a.size === b.size && [...a].every((item) => b.has(item));
}
export { HitIndex, Markmap, SvgDomBackend, Tween, animationFrames, combineGestures, defaultGestures, interpolateZoom, panZoomGestures, pointerGestures, resolveViewOptions };
