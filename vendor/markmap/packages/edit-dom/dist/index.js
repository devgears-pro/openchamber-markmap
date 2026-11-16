import { EditError, applyCommand, lineEnding, mapOffset } from "@markmap/edit";
import { labelText, nodeAtOffset, notesText, parseDocument } from "@markmap/model";
import { select } from "d3-selection";
// src/history.ts
var LIMIT = 100;
var History = class {
	undoStack = [];
	redoStack = [];
	get canUndo() {
		return this.undoStack.length > 0;
	}
	get canRedo() {
		return this.redoStack.length > 0;
	}
	push(entry) {
		this.undoStack.push(entry);
		if (this.undoStack.length > LIMIT) this.undoStack.shift();
		this.redoStack = [];
	}
	undo(current) {
		const entry = this.undoStack.pop();
		if (!entry) return void 0;
		this.redoStack.push(current);
		return entry;
	}
	redo(current) {
		const entry = this.redoStack.pop();
		if (!entry) return void 0;
		this.undoStack.push(current);
		return entry;
	}
	clear() {
		this.undoStack = [];
		this.redoStack = [];
	}
};
// src/editor.ts
var STYLE_ID = "mm-editor-style";
var MODE_SELECT = "mm-editor-mode-select";
var MODE_EDIT = "mm-editor-mode-edit";
var EMPTY_LABEL = "​";
var DRAG_THRESHOLD = 4;
var DRAG_EDGE = 60;
var DRAG_PAN_MAX = 14;
var DRAG_EXPAND_MS = 400;
var SNAP_BACK_MS = 140;
var STYLE = `
.mm-editor-layer{position:absolute;inset:0;pointer-events:none;z-index:2}
.mm-editor-field{position:absolute;display:none;margin:0;padding:0 8px;border:0;background:transparent;color:inherit;font:inherit;line-height:1.25;text-align:center;white-space:pre-wrap;resize:none;overflow:hidden;outline:none;box-sizing:border-box;pointer-events:auto;transform-origin:top left}
.mm-editor-selection{position:absolute;display:none;pointer-events:none;box-sizing:border-box;border:2px solid var(--oc-focus,#0097e6);border-radius:6px}
.mm-editor-editing text{visibility:hidden}
.mm-editor-notes{position:absolute;display:flex;flex-direction:column;gap:8px;padding:10px;box-sizing:border-box;background:var(--oc-elevated,light-dark(#fff,#1f1f1f));color:var(--oc-fg,light-dark(#1f2328,#e6e3df));border:1px solid var(--oc-border,light-dark(rgba(0,0,0,.14),rgba(255,255,255,.16)));border-radius:var(--oc-radius,8px);box-shadow:0 10px 28px rgba(0,0,0,.18);pointer-events:auto;z-index:3;font:inherit;text-align:left;overflow:hidden}
.mm-editor-notes-header{display:flex;align-items:center;gap:6px;min-height:20px;padding:0 2px 8px;border-bottom:1px solid var(--oc-border,light-dark(rgba(0,0,0,.1),rgba(255,255,255,.12)))}
.mm-editor-notes-icon{flex:none;width:16px;height:16px;color:var(--oc-muted,light-dark(#656d76,#9aa0a6))}
.mm-editor-notes-title{font-size:.9em;font-weight:600;line-height:1.2}
.mm-editor-notes-label{margin-left:auto;color:var(--oc-muted,light-dark(#656d76,#9aa0a6));font-size:.75em;line-height:1.2;letter-spacing:.02em}
.mm-editor-notes-toolbar{display:flex;flex-wrap:wrap;gap:4px}
.mm-editor-notes-toolbar button{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin:0;padding:0;border:1px solid transparent;border-radius:calc(var(--oc-radius,8px) - 2px);background:transparent;color:inherit;font:inherit;line-height:1;cursor:pointer}
.mm-editor-notes-toolbar button:hover{background:var(--oc-hover,light-dark(rgba(0,0,0,.06),rgba(255,255,255,.08)));border-color:var(--oc-border,light-dark(rgba(0,0,0,.14),rgba(255,255,255,.16)))}
.mm-editor-notes-toolbar button:focus-visible{outline:2px solid var(--oc-focus,#0097e6);outline-offset:1px}
.mm-editor-notes-toolbar svg{display:block;width:16px;height:16px}
.mm-editor-notes-field{flex:1 1 auto;min-height:96px;margin:0;padding:8px 10px;border:1px solid var(--oc-border,light-dark(rgba(0,0,0,.14),rgba(255,255,255,.16)));border-radius:calc(var(--oc-radius,8px) - 2px);background:var(--oc-bg,light-dark(#fff,#141414));color:inherit;font:inherit;line-height:1.45;resize:none;overflow:auto;outline:none;box-sizing:border-box}
.mm-editor-notes-field:focus{border-color:var(--oc-focus,#0097e6);box-shadow:0 0 0 2px color-mix(in srgb,var(--oc-focus,#0097e6) 20%,transparent)}
.mm-editor-drag-ghost{pointer-events:none}
.mm-editor-drag-ghost [data-key]{opacity:.92;filter:drop-shadow(0 6px 16px rgba(0,0,0,.28))}
.mm-editor-drag-source{opacity:.35}
.mm-editor-drop{position:absolute;display:none;pointer-events:none;box-sizing:border-box;z-index:2}
.mm-editor-drop-line{background:var(--oc-focus,#0097e6);border-radius:999px}
.mm-editor-drop-frame{border:2px solid var(--oc-focus,#0097e6);border-radius:8px}
.mm-editor-dragging{cursor:grabbing;user-select:none}
`;
var styleUsers = /* @__PURE__ */ new WeakMap();
var NOTE_ICON = "M3 13l1-3.4L11 2.6a1.7 1.7 0 0 1 2.4 2.4L6.4 12 3 13zM9.9 3.7l2.4 2.4";
var NOTE_ACTIONS = [
	{
		format: "bold",
		name: "Bold",
		icon: "M5 3h3.3a2.35 2.35 0 0 1 0 4.7H5zM5 7.7h3.9a2.65 2.65 0 0 1 0 5.3H5z"
	},
	{
		format: "italic",
		name: "Italic",
		icon: "M6.8 3h4.7M4.5 13h4.7M9.6 3 7 13"
	},
	{
		format: "code",
		name: "Inline code",
		icon: "M5.8 5.2 3 8l2.8 2.8M10.2 5.2 13 8l-2.8 2.8"
	},
	{
		format: "link",
		name: "Link",
		icon: "M6.7 9.3a2.4 2.4 0 0 0 3.4 0l1.8-1.8A2.4 2.4 0 0 0 8.5 4.1L7.4 5.2M9.3 6.7a2.4 2.4 0 0 0-3.4 0L4.1 8.5a2.4 2.4 0 0 0 3.4 3.4l1.1-1.1"
	},
	{
		format: "quote",
		name: "Quote",
		icon: "M3.5 4v8M6.5 5h6M6.5 8h6M6.5 11h4"
	},
	{
		format: "block",
		name: "Code block",
		icon: "M2.8 3.8h10.4v8.4H2.8zM6.4 6.6 4.8 8l1.6 1.4M9.6 6.6 11.2 8l-1.6 1.4"
	}
];
function noteIcon(doc, path) {
	const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 16 16");
	svg.setAttribute("width", "16");
	svg.setAttribute("height", "16");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("focusable", "false");
	const shape = doc.createElementNS("http://www.w3.org/2000/svg", "path");
	shape.setAttribute("d", path);
	shape.setAttribute("fill", "none");
	shape.setAttribute("stroke", "currentColor");
	shape.setAttribute("stroke-width", "1.5");
	shape.setAttribute("stroke-linecap", "round");
	shape.setAttribute("stroke-linejoin", "round");
	svg.append(shape);
	return svg;
}
function acquireStyle(doc) {
	const count = styleUsers.get(doc) ?? 0;
	if (!count && !doc.getElementById(STYLE_ID)) {
		const style = doc.createElement("style");
		style.id = STYLE_ID;
		style.textContent = STYLE;
		doc.head.append(style);
	}
	styleUsers.set(doc, count + 1);
}
function releaseStyle(doc) {
	const count = (styleUsers.get(doc) ?? 1) - 1;
	if (count > 0) {
		styleUsers.set(doc, count);
		return;
	}
	styleUsers.delete(doc);
	doc.getElementById(STYLE_ID)?.remove();
}
function backtickRun(text) {
	let longest = 0;
	for (const run of text.match(/`+/gu) ?? []) longest = Math.max(longest, run.length);
	return longest + 1;
}
function sameTarget(left, right) {
	if (!left || !right) return left === right;
	return left.parentId === right.parentId && left.index === right.index && left.kind === right.kind && left.targetId === right.targetId;
}
var MarkmapEditor = class {
	view;
	container;
	field;
	selectionBox;
	indicator;
	layer;
	history = new History();
	onChange;
	onError;
	placeholder;
	restorePosition;
	restoreTabIndex;
	stops = [];
	doc;
	title = "";
	selectedId = null;
	selectionOffset = 0;
	editing = null;
	notes = null;
	drag = null;
	suppressClick = false;
	previewing = false;
	destroyed = false;
	constructor({ source, view, container, placeholder, onChange, onError }) {
		this.view = view;
		this.container = container;
		const parsed = parseDocument(source);
		this.doc = parsed.document;
		this.title = typeof parsed.frontmatter.title === "string" ? parsed.frontmatter.title : "";
		this.onChange = onChange;
		this.onError = onError;
		this.placeholder = placeholder?.trim() || "New topic";
		const doc = container.ownerDocument;
		acquireStyle(doc);
		const position = doc.defaultView?.getComputedStyle(container).position;
		this.restorePosition = !position || position === "static";
		if (this.restorePosition) container.style.position = "relative";
		this.restoreTabIndex = !container.hasAttribute("tabindex");
		if (this.restoreTabIndex) container.tabIndex = 0;
		this.layer = doc.createElement("div");
		this.layer.className = "mm-editor-layer";
		this.selectionBox = doc.createElement("div");
		this.selectionBox.className = "mm-editor-selection";
		this.indicator = doc.createElement("div");
		this.indicator.className = "mm-editor-drop";
		this.field = doc.createElement("textarea");
		this.field.className = "mm-editor-field";
		this.field.spellcheck = false;
		this.field.autocomplete = "off";
		this.field.setAttribute("autocapitalize", "off");
		this.field.setAttribute("wrap", "soft");
		this.field.addEventListener("input", this.handleInput);
		this.layer.append(this.selectionBox, this.indicator, this.field);
		container.append(this.layer);
		container.addEventListener("keydown", this.handleKeyDown);
		container.addEventListener("click", this.handleClick);
		container.addEventListener("dblclick", this.handleDoubleClick);
		container.addEventListener("pointerdown", this.handlePointerDown, true);
		container.addEventListener("mousedown", this.handleMouseDown, true);
		this.stops.push(this.view.on("render", this.handleViewChange));
		this.stops.push(this.view.on("zoom", this.handleViewChange));
		this.selectedId = this.doc.root;
		this.selectionOffset = this.doc.nodes.get(this.doc.root)?.label?.start ?? 0;
		this.setMode(false);
		this.paintSelection();
	}
	get source() {
		return this.doc.source;
	}
	get document() {
		return this.doc;
	}
	get selected() {
		return this.selectedId;
	}
	get selection() {
		return this.selectionOffset;
	}
	get isEditing() {
		return this.editing !== null;
	}
	get isEditingNotes() {
		return this.notes !== null;
	}
	get canUndo() {
		return this.history.canUndo;
	}
	get canRedo() {
		return this.history.canRedo;
	}
	focus() {
		this.container.focus({ preventScroll: true });
	}
	setSource(source, options = {}) {
		const parsed = parseDocument(source);
		this.closeNotes(false);
		this.stopEditingUi(false);
		this.doc = parsed.document;
		this.title = typeof parsed.frontmatter.title === "string" ? parsed.frontmatter.title : "";
		this.history.clear();
		this.view.setTree(parsed.tree);
		const offset = options.selection ?? this.doc.nodes.get(this.doc.root)?.label?.start ?? 0;
		if (options.selection == null) {
			this.selectionOffset = offset;
			this.select(this.doc.root, { reveal: false });
		} else this.selectAt(offset, { reveal: false });
		if (options.emit) this.emitChange();
	}
	startEditing(nodeId = this.selectedId, options = {}) {
		if (!nodeId) return;
		if (this.editing) {
			if (this.editing.nodeId === nodeId) return;
			if (this.commitEditing() === "error") return;
		}
		const node = this.doc.nodes.get(nodeId);
		if (!node) return;
		const first = this.isEmptyRoot(node);
		if (!node.label && !first) {
			if (node.kind === "root" && this.title) this.onError?.(new EditError("E_LABEL", "The root title comes from frontmatter; edit it in the source view", node.id));
			return;
		}
		if (!this.view.screenRect(nodeId)) return;
		const label = node.label ? labelText(this.doc, node) : "";
		const blank = first || label === EMPTY_LABEL;
		const text = options.initialText ?? (blank ? "" : label);
		this.field.value = text;
		this.field.style.display = "block";
		this.editing = {
			nodeId,
			previewId: nodeId,
			original: label,
			blank,
			first,
			preview: false,
			folds: [...this.view.foldedIds],
			field: this.field
		};
		this.setMode(true);
		if (options.initialText !== void 0) this.previewEditing();
		this.paintEditing();
		this.positionEditing();
		this.paintSelection();
		this.field.focus({ preventScroll: true });
		if (options.selectAll) this.field.select();
		else this.field.setSelectionRange(text.length, text.length);
	}
	editNotes(nodeId) {
		const requested = nodeId ?? this.selectedId;
		if (!requested) return false;
		if (this.notes) {
			if (this.notes.nodeId === requested) return true;
			if (this.commitNotes({ keepOpen: false }) === "error") return false;
		}
		if (this.editing && this.commitEditing() === "error") return false;
		const id = nodeId ?? this.selectedId;
		if (!id) return false;
		const node = this.doc.nodes.get(id);
		if (!node) return false;
		if (node.opaque || !node.capabilities.editNotes) {
			this.onError?.(new EditError("E_CAPABILITY", "The node cannot hold notes", node.id));
			return false;
		}
		if (!(node.label ? labelText(this.doc, node) : "").trim() && !(node.kind === "root" && this.title)) {
			this.onError?.(new EditError("E_LABEL", "The node has no label", node.id));
			return false;
		}
		if (!this.view.screenRect(node.id)) return false;
		this.select(node.id, { reveal: false });
		this.openNotes(node);
		return true;
	}
	commitForSnapshot() {
		if (this.notes) {
			this.commitNotes({ keepOpen: true });
			return this.doc.source;
		}
		const editing = this.editing;
		if (!editing) return this.doc.source;
		const text = editing.field.value;
		if (text === editing.original || editing.blank && text === "") return this.doc.source;
		const before = this.snapshot();
		const result = editing.first ? this.apply({
			type: "insertFirst",
			node: editing.nodeId,
			text
		}) : this.apply({
			type: "setLabel",
			node: editing.nodeId,
			text
		});
		if (!result) return this.doc.source;
		this.history.push(before);
		const target = nodeAtOffset(result.document, result.selection);
		if (target) {
			editing.nodeId = target.id;
			editing.previewId = target.id;
		}
		editing.original = text;
		editing.blank = false;
		editing.first = false;
		editing.preview = false;
		editing.folds = [...this.view.foldedIds];
		return this.doc.source;
	}
	setLabel(nodeId, text) {
		if (!this.doc.nodes.has(nodeId)) return false;
		const before = this.snapshot();
		if (!this.apply({
			type: "setLabel",
			node: nodeId,
			text
		})) return false;
		this.history.push(before);
		return true;
	}
	selectedBlock() {
		const node = this.selectedNode();
		if (!node) return null;
		if (node.block) return this.doc.source.slice(node.block.start, node.block.end);
		if (node.id !== this.doc.root) return null;
		const children = node.children.map((id) => this.doc.nodes.get(id)).filter((child) => Boolean(child?.block));
		const first = children[0];
		const last = children[children.length - 1];
		const ranges = node.notes.map((note) => note.range);
		if (first?.block) ranges.push(first.block);
		if (last?.block) ranges.push(last.block);
		const start = ranges.length ? Math.min(...ranges.map((range) => range.start)) : null;
		const end = ranges.length ? Math.max(...ranges.map((range) => range.end)) : null;
		const body = start == null || end == null ? "" : this.doc.source.slice(start, end);
		const title = this.title.replace(/\s+/gu, " ").trim();
		if (!title) return body || null;
		const heading = `# ${title}`;
		const ending = lineEnding(this.doc.source);
		return body ? `${heading}${ending}${ending}${body}` : heading;
	}
	insertBlock(text) {
		return this.runSelected({
			type: "insertBlock",
			text
		}) !== null;
	}
	insertLabel(text) {
		return this.runSelected({
			type: "insertChild",
			text
		}) !== null;
	}
	deleteSelected() {
		return this.runSelected({ type: "delete" }) !== null;
	}
	commit() {
		if (this.notes) {
			this.commitNotes({ keepOpen: false });
			return;
		}
		this.commitEditing();
	}
	undo() {
		const entry = this.history.undo(this.snapshot());
		if (!entry) return false;
		this.restore(entry);
		return true;
	}
	redo() {
		const entry = this.history.redo(this.snapshot());
		if (!entry) return false;
		this.restore(entry);
		return true;
	}
	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		for (const stop of this.stops) stop();
		this.stops.length = 0;
		this.container.removeEventListener("keydown", this.handleKeyDown);
		this.container.removeEventListener("click", this.handleClick);
		this.container.removeEventListener("dblclick", this.handleDoubleClick);
		this.container.removeEventListener("pointerdown", this.handlePointerDown, true);
		this.container.removeEventListener("mousedown", this.handleMouseDown, true);
		this.field.removeEventListener("input", this.handleInput);
		this.cancelDrag();
		this.closeNotes(false);
		this.layer.remove();
		releaseStyle(this.container.ownerDocument);
		if (this.restorePosition) this.container.style.position = "";
		if (this.restoreTabIndex) this.container.removeAttribute("tabindex");
		this.container.classList.remove(MODE_SELECT, MODE_EDIT);
		this.editing = null;
		this.selectedId = null;
	}
	handleInput = () => {
		if (!this.editing) return;
		this.previewEditing();
		this.positionEditing();
		this.paintSelection();
		this.paintEditing();
	};
	handleViewChange = () => {
		if (this.notes) this.positionNotes();
		if (this.previewing) return;
		if (this.editing) this.positionEditing();
		this.paintSelection();
		this.paintEditing();
		const drag = this.drag;
		if (drag?.active) {
			this.paintDragSource(drag);
			this.paintDropTarget(drag);
		}
	};
	handleClick = (event) => {
		if (this.suppressClick) {
			this.suppressClick = false;
			event.preventDefault();
			return;
		}
		const target = event.target;
		if (this.notes) {
			if (target instanceof Node && this.notes.panel.contains(target)) return;
			if (this.commitNotes({ keepOpen: false }) === "error") return;
		}
		if (this.editing && target instanceof Node && this.editing.field.contains(target)) return;
		if (event.button !== 0) return;
		if (this.editing && this.commitEditing() === "error") return;
		const hit = this.hitAt(event);
		if ((hit?.kind === "node" || hit?.kind === "toggle") && hit.nodeId) {
			this.select(hit.nodeId, { reveal: false });
			this.container.focus({ preventScroll: true });
		}
	};
	handleDoubleClick = (event) => {
		if (this.editing || this.notes) return;
		const hit = this.hitAt(event);
		if (hit?.kind === "node" && hit.nodeId) {
			this.select(hit.nodeId, { reveal: false });
			this.startEditing(hit.nodeId);
			event.preventDefault();
		}
	};
	handleMouseDown = (event) => {
		if (event.button !== 0) return;
		if (this.notes) {
			const target = event.target;
			if (!(target instanceof Node) || !this.notes.panel.contains(target)) {
				if (this.commitNotes({ keepOpen: false }) === "error") {
					event.preventDefault();
					event.stopPropagation();
					return;
				}
			}
		}
		if (!this.dragNodeAt(event)) return;
		event.preventDefault();
		event.stopPropagation();
	};
	handlePointerDown = (event) => {
		if (event.pointerType === "touch") return;
		if (event.button !== 0 || event.isPrimary === false) return;
		if (this.destroyed) return;
		if (this.notes) {
			const target = event.target;
			if (!(target instanceof Node) || !this.notes.panel.contains(target)) {
				if (this.commitNotes({ keepOpen: false }) === "error") return;
			}
		}
		const nodeId = this.dragNodeAt(event);
		if (!nodeId) return;
		if (!this.doc.nodes.get(nodeId)?.capabilities.move) return;
		if (this.editing && this.commitEditing() === "error") return;
		const win = this.container.ownerDocument.defaultView;
		if (!win) return;
		this.drag = {
			nodeId,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			clientX: event.clientX,
			clientY: event.clientY,
			active: false,
			ghost: null,
			sourceIds: this.subtreeIds(nodeId),
			folds: [...this.view.foldedIds],
			target: null,
			hover: null,
			pan: null,
			win
		};
		win.addEventListener("pointermove", this.handlePointerMove, true);
		win.addEventListener("pointerup", this.handlePointerUp, true);
		win.addEventListener("pointercancel", this.handlePointerCancel, true);
		win.addEventListener("keydown", this.handleDragKey, true);
	};
	handlePointerMove = (event) => {
		const drag = this.drag;
		if (!drag || event.pointerId !== drag.pointerId) return;
		drag.clientX = event.clientX;
		drag.clientY = event.clientY;
		if (!drag.active) {
			if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
			this.startDrag(drag);
			return;
		}
		this.updateDrag(drag);
	};
	handlePointerUp = (event) => {
		const drag = this.drag;
		if (!drag || event.pointerId !== drag.pointerId) return;
		if (!drag.active) {
			this.finishDrag(false);
			return;
		}
		drag.clientX = event.clientX;
		drag.clientY = event.clientY;
		this.updateDrag(drag);
		this.finishDrag(drag.target !== null);
	};
	handlePointerCancel = () => {
		this.finishDrag(false);
	};
	handleDragKey = (event) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		event.stopPropagation();
		this.finishDrag(false);
	};
	dragNodeAt(event) {
		const target = event.target;
		if (target instanceof Node) {
			if (this.field.contains(target)) return null;
			if (this.notes?.panel.contains(target)) return null;
		}
		const hit = this.hitAt(event);
		return hit?.kind === "node" && hit.nodeId ? hit.nodeId : null;
	}
	startDrag(drag) {
		drag.active = true;
		this.select(drag.nodeId, { reveal: false });
		this.container.classList.add("mm-editor-dragging");
		if (typeof this.container.setPointerCapture === "function") this.container.setPointerCapture(drag.pointerId);
		const ghost = this.buildGhost(drag.nodeId, drag.sourceIds);
		drag.ghost = ghost;
		this.view.element.append(ghost);
		this.paintDragSource(drag);
		this.updateDrag(drag);
	}
	updateDrag(drag) {
		if (drag.ghost) drag.ghost.style.transform = `translate(${drag.clientX - drag.startX}px, ${drag.clientY - drag.startY}px)`;
		const next = this.dropTargetAt(drag, drag.clientX, drag.clientY);
		if (!sameTarget(drag.target, next)) {
			drag.target = next;
			this.paintDropTarget(drag);
			this.scheduleHover(drag);
		}
		this.updateAutoPan(drag);
	}
	buildGhost(nodeId, ids) {
		const svg = this.view.element;
		const ghost = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
		ghost.classList.add("mm-editor-drag-ghost");
		const content = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
		const { k, x, y } = this.view.transform;
		content.setAttribute("transform", `matrix(${k} 0 0 ${k} ${x} ${y})`);
		const keys = /* @__PURE__ */ new Set();
		for (const id of ids) {
			keys.add(`node:${id}`);
			if (id !== nodeId) keys.add(`edge:${id}`);
		}
		for (const element of svg.querySelectorAll("[data-key]")) {
			const key = element.getAttribute("data-key");
			if (key && keys.has(key)) content.append(element.cloneNode(true));
		}
		ghost.append(content);
		return ghost;
	}
	paintDragSource(drag) {
		this.clearDragSource();
		for (const id of drag.sourceIds) {
			this.view.element.querySelector(`[data-key="node:${id}"]`)?.classList.add("mm-editor-drag-source");
			this.view.element.querySelector(`[data-key="edge:${id}"]`)?.classList.add("mm-editor-drag-source");
		}
	}
	clearDragSource() {
		for (const element of this.view.element.querySelectorAll(".mm-editor-drag-source")) element.classList.remove("mm-editor-drag-source");
	}
	paintDropTarget(drag) {
		const target = drag.target;
		const rect = target ? this.view.screenRect(target.targetId) : void 0;
		if (!target || !rect) {
			this.indicator.style.display = "none";
			return;
		}
		const box = this.container.getBoundingClientRect();
		const style = this.indicator.style;
		this.indicator.className = "mm-editor-drop";
		if (target.kind === "child") {
			this.indicator.classList.add("mm-editor-drop-frame");
			style.left = `${rect.x - box.x - 3}px`;
			style.top = `${rect.y - box.y - 3}px`;
			style.width = `${rect.width + 6}px`;
			style.height = `${rect.height + 6}px`;
		} else {
			this.indicator.classList.add("mm-editor-drop-line");
			if (this.isVertical(target.targetId)) {
				style.left = `${(target.kind === "before" ? rect.x - 6 : rect.x + rect.width + 4) - box.x}px`;
				style.top = `${rect.y - box.y}px`;
				style.width = "2px";
				style.height = `${Math.max(rect.height, 24)}px`;
			} else {
				const top = target.kind === "before" ? rect.y - 6 : rect.y + rect.height + 4;
				style.left = `${rect.x - box.x}px`;
				style.top = `${top - box.y}px`;
				style.width = `${Math.max(rect.width, 24)}px`;
				style.height = "2px";
			}
		}
		style.display = "block";
	}
	dropTargetAt(drag, x, y) {
		const dragged = this.doc.nodes.get(drag.nodeId);
		if (!dragged) return null;
		const excluded = new Set(drag.sourceIds);
		const boxes = [];
		for (const id of this.doc.order) {
			const node = this.doc.nodes.get(id);
			if (!node || node.id === this.doc.root || excluded.has(node.id) || node.opaque) continue;
			const rect = this.view.screenRect(node.id);
			if (rect) boxes.push({
				node,
				rect
			});
		}
		for (const box of boxes) if (x >= box.rect.x - 4 && x <= box.rect.x + box.rect.width + 4 && y >= box.rect.y - 4 && y <= box.rect.y + box.rect.height + 4) return this.zoneTarget(dragged, box.node, box.rect, x, y, false);
		const root = this.doc.nodes.get(this.doc.root);
		if (root) {
			const rootRect = this.view.screenRect(root.id);
			if (rootRect && x >= rootRect.x - 48 && x <= rootRect.x + rootRect.width + 48 && y >= rootRect.y - 48 && y <= rootRect.y + rootRect.height + 48) return this.rootTarget(root, dragged, rootRect, x, y);
		}
		let nearest = null;
		let distance = 24;
		for (const box of boxes) {
			const dx = Math.max(box.rect.x - x, 0, x - box.rect.x - box.rect.width);
			const dy = Math.max(box.rect.y - y, 0, y - box.rect.y - box.rect.height);
			const current = Math.hypot(dx, dy);
			if (current <= distance) {
				distance = current;
				nearest = box;
			}
		}
		return nearest ? this.zoneTarget(dragged, nearest.node, nearest.rect, x, y, true) : null;
	}
	zoneTarget(dragged, node, rect, x, y, gap) {
		const vertical = this.isVertical(node.id);
		let kind;
		if (gap) kind = (vertical ? x < rect.x + rect.width / 2 : y < rect.y + rect.height / 2) ? "before" : "after";
		else if (vertical) {
			const quarter = Math.max(4, rect.width / 4);
			if (x < rect.x + quarter) kind = "before";
			else if (x > rect.x + rect.width - quarter) kind = "after";
			else kind = "child";
		} else {
			const quarter = Math.max(4, rect.height / 4);
			if (y < rect.y + quarter) kind = "before";
			else if (y > rect.y + rect.height - quarter) kind = "after";
			else kind = "child";
		}
		if (kind === "child") {
			if (!node.capabilities.addChild) kind = vertical ? x < rect.x + rect.width / 2 ? "before" : "after" : y < rect.y + rect.height / 2 ? "before" : "after";
			else return {
				parentId: node.id,
				index: node.children.filter((id) => id !== dragged.id).length,
				kind,
				targetId: node.id
			};
		}
		const parentId = node.parent;
		if (!parentId) return null;
		const parent = this.doc.nodes.get(parentId);
		if (!parent) return null;
		const base = parent.children.filter((id) => id !== dragged.id).indexOf(node.id);
		return {
			parentId,
			index: kind === "before" ? base : base + 1,
			kind,
			targetId: node.id
		};
	}
	rootTarget(root, dragged, rootRect, x, y) {
		const siblings = root.children.filter((id) => id !== dragged.id);
		if (!siblings.length) return null;
		const wanted = x < rootRect.x + rootRect.width / 2 ? "left" : "right";
		const sided = siblings.filter((id) => this.view.direction(id) === wanted);
		const pool = sided.length ? sided : siblings;
		let nearest = pool[0];
		let nearestRect = this.view.screenRect(nearest);
		let best = Infinity;
		for (const id of pool) {
			const rect = this.view.screenRect(id);
			if (!rect) continue;
			const distance = Math.hypot(x - (rect.x + rect.width / 2), y - (rect.y + rect.height / 2));
			if (distance < best) {
				best = distance;
				nearest = id;
				nearestRect = rect;
			}
		}
		if (!nearestRect) return null;
		const before = this.isVertical(nearest) ? x < nearestRect.x + nearestRect.width / 2 : y < nearestRect.y + nearestRect.height / 2;
		const base = siblings.indexOf(nearest);
		return {
			parentId: root.id,
			index: before ? base : base + 1,
			kind: before ? "before" : "after",
			targetId: nearest
		};
	}
	isVertical(id) {
		const direction = this.view.direction(id);
		return direction === "top" || direction === "bottom";
	}
	scheduleHover(drag) {
		if (drag.hover !== null) {
			drag.win.clearTimeout(drag.hover);
			drag.hover = null;
		}
		const target = drag.target;
		if (!target || target.kind !== "child" || !this.view.foldedIds.has(target.targetId)) return;
		drag.hover = drag.win.setTimeout(() => {
			drag.hover = null;
			this.view.setFolded(target.targetId, false);
			this.updateDrag(drag);
		}, DRAG_EXPAND_MS);
	}
	updateAutoPan(drag) {
		if (this.edgeVector(drag.clientX, drag.clientY) === null) {
			this.stopAutoPan();
			return;
		}
		if (drag.pan !== null) return;
		const step = () => {
			const current = this.drag;
			if (!current?.active) {
				this.stopAutoPan();
				return;
			}
			const vector = this.edgeVector(current.clientX, current.clientY);
			if (!vector) {
				this.stopAutoPan();
				return;
			}
			this.view.panBy(vector.x, vector.y);
			current.pan = current.win.requestAnimationFrame(step);
			this.afterPan(current);
		};
		drag.pan = drag.win.requestAnimationFrame(step);
	}
	stopAutoPan() {
		const drag = this.drag;
		if (!drag || drag.pan === null) return;
		drag.win.cancelAnimationFrame(drag.pan);
		drag.pan = null;
	}
	edgeVector(x, y) {
		const box = this.container.getBoundingClientRect();
		const left = x - box.x;
		const right = box.x + box.width - x;
		const top = y - box.y;
		const bottom = box.y + box.height - y;
		const closest = Math.min(left, right, top, bottom);
		if (closest > DRAG_EDGE) return null;
		const speed = Math.max(1, (DRAG_EDGE - Math.max(0, closest)) / DRAG_EDGE * DRAG_PAN_MAX);
		const vector = {
			x: 0,
			y: 0
		};
		if (left < DRAG_EDGE) vector.x = speed;
		else if (right < DRAG_EDGE) vector.x = -speed;
		if (top < DRAG_EDGE) vector.y = speed;
		else if (bottom < DRAG_EDGE) vector.y = -speed;
		return vector;
	}
	afterPan(drag) {
		const next = this.dropTargetAt(drag, drag.clientX, drag.clientY);
		if (!sameTarget(drag.target, next)) {
			drag.target = next;
			this.paintDropTarget(drag);
			this.scheduleHover(drag);
		}
	}
	finishDrag(drop) {
		const drag = this.drag;
		if (!drag) return;
		this.stopAutoPan();
		if (drag.hover !== null) {
			drag.win.clearTimeout(drag.hover);
			drag.hover = null;
		}
		drag.win.removeEventListener("pointermove", this.handlePointerMove, true);
		drag.win.removeEventListener("pointerup", this.handlePointerUp, true);
		drag.win.removeEventListener("pointercancel", this.handlePointerCancel, true);
		drag.win.removeEventListener("keydown", this.handleDragKey, true);
		if (drag.active) {
			if (typeof this.container.releasePointerCapture === "function") this.container.releasePointerCapture(drag.pointerId);
			this.suppressClick = true;
			this.applyFoldState(drag.folds);
			if (drop && drag.target) this.moveTo(drag.target.parentId, drag.target.index, drag.nodeId);
		}
		const ghost = drag.ghost;
		if (ghost) {
			if (drag.active && !drop) {
				ghost.style.transition = `transform ${SNAP_BACK_MS}ms ease, opacity ${SNAP_BACK_MS}ms ease`;
				ghost.style.transform = "translate(0px, 0px)";
				ghost.style.opacity = "0";
				drag.win.setTimeout(() => ghost.remove(), SNAP_BACK_MS);
			} else ghost.remove();
		}
		drag.ghost = null;
		this.container.classList.remove("mm-editor-dragging");
		this.clearDragSource();
		this.indicator.style.display = "none";
		this.drag = null;
		this.paintSelection();
		this.container.focus({ preventScroll: true });
	}
	cancelDrag() {
		const drag = this.drag;
		if (!drag) return;
		this.stopAutoPan();
		if (drag.hover !== null) drag.win.clearTimeout(drag.hover);
		drag.win.removeEventListener("pointermove", this.handlePointerMove, true);
		drag.win.removeEventListener("pointerup", this.handlePointerUp, true);
		drag.win.removeEventListener("pointercancel", this.handlePointerCancel, true);
		drag.win.removeEventListener("keydown", this.handleDragKey, true);
		if (typeof this.container.releasePointerCapture === "function") this.container.releasePointerCapture(drag.pointerId);
		drag.ghost?.remove();
		this.container.classList.remove("mm-editor-dragging");
		this.clearDragSource();
		this.indicator.style.display = "none";
		this.drag = null;
	}
	applyFoldState(ids) {
		this.view.setFoldedIds(ids, { animate: false });
	}
	subtreeIds(id) {
		const ids = [];
		const visit = (nodeId) => {
			ids.push(nodeId);
			const node = this.doc.nodes.get(nodeId);
			if (!node) return;
			for (const child of node.children) visit(child);
		};
		visit(id);
		return ids;
	}
	moveByKey(key) {
		const node = this.selectedNode();
		if (!node?.parent) return;
		const parent = this.doc.nodes.get(node.parent);
		if (!parent) return;
		const index = parent.children.indexOf(node.id);
		if (key === "ArrowUp" && index > 0) {
			this.moveTo(parent.id, index - 1, node.id);
			return;
		}
		if (key === "ArrowDown" && index < parent.children.length - 1) {
			this.moveTo(parent.id, index + 1, node.id);
			return;
		}
		if (key === "ArrowLeft" && index > 0) {
			const previous = this.doc.nodes.get(parent.children[index - 1]);
			if (previous) this.moveTo(previous.id, previous.children.length, node.id);
			return;
		}
		if (key === "ArrowRight" && parent.parent) {
			const grand = this.doc.nodes.get(parent.parent);
			if (grand) this.moveTo(grand.id, grand.children.indexOf(parent.id) + 1, node.id);
		}
	}
	moveTo(parentId, index, nodeId) {
		const node = this.doc.nodes.get(nodeId);
		if (!node) return false;
		if (node.parent === parentId) {
			const parent = this.doc.nodes.get(parentId);
			if (parent && parent.children.indexOf(node.id) === index) return false;
		}
		if (!this.run({
			type: "move",
			node: node.id,
			parent: parentId,
			index
		})) return false;
		if (this.selectedId) this.ensureVisible(this.selectedId);
		return true;
	}
	handleKeyDown = (event) => {
		if (event.defaultPrevented) return;
		if (event.isComposing || event.keyCode === 229) return;
		if (this.notes) {
			this.handleNotesKey(event);
			return;
		}
		if (this.editing) {
			this.handleEditingKey(event);
			return;
		}
		const mod = event.metaKey || event.ctrlKey;
		if (mod && event.key.toLowerCase() === "z") {
			event.preventDefault();
			if (event.shiftKey) this.redo();
			else this.undo();
			return;
		}
		if (mod && event.key === "/") {
			event.preventDefault();
			if (this.selectedId) this.view.toggle(this.selectedId);
			return;
		}
		if (!this.selectedId) return;
		if (mod && event.shiftKey && event.key.startsWith("Arrow")) {
			event.preventDefault();
			this.moveByKey(event.key);
			return;
		}
		switch (event.key) {
			case "Enter":
				event.preventDefault();
				this.insertAndEdit("insertSibling");
				return;
			case "Tab":
				event.preventDefault();
				if (event.shiftKey) this.runSelected({ type: "outdent" });
				else this.insertAndEdit("insertChild");
				return;
			case "Delete":
			case "Backspace":
				event.preventDefault();
				if (this.isEmptyRoot(this.selectedNode())) return;
				this.runSelected({ type: "delete" });
				return;
			case " ":
				if (event.altKey || mod || event.shiftKey) return;
				event.preventDefault();
				this.startEditing();
				return;
			case "Escape":
				event.preventDefault();
				return;
			case "ArrowUp":
			case "ArrowDown":
			case "ArrowLeft":
			case "ArrowRight":
				event.preventDefault();
				this.navigate(event.key);
				return;
			default:
				if (event.altKey || mod || event.key.length !== 1) return;
				if (!this.isEmptyLabel(this.selectedNode())) return;
				event.preventDefault();
				this.startEditing(this.selectedId, { initialText: event.key });
		}
	};
	handleEditingKey(event) {
		if (event.isComposing || event.keyCode === 229) return;
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
			if (this.editing && !event.shiftKey && this.editing.field.value !== this.editing.original) {
				event.preventDefault();
				const field = this.editing.field;
				field.value = this.editing.original;
				field.setSelectionRange(field.value.length, field.value.length);
				this.previewEditing();
				this.positionEditing();
				this.paintSelection();
				this.paintEditing();
				return;
			}
			if (this.editing && this.editing.field.value === this.editing.original) {
				event.preventDefault();
				this.stopEditingUi();
				if (event.shiftKey) this.redo();
				else this.undo();
			}
			return;
		}
		const editing = this.editing;
		if (editing && (event.key === "Backspace" || event.key === "Delete") && editing.blank && editing.field.value === "") {
			if (this.isEmptyRoot(this.doc.nodes.get(editing.nodeId))) return;
			event.preventDefault();
			this.stopEditingUi();
			this.select(editing.nodeId, { reveal: false });
			this.runSelected({ type: "delete" });
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			this.cancelEditing();
			return;
		}
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			this.commitEditing();
			return;
		}
		if (event.key === "Tab") {
			event.preventDefault();
			this.commitAndInsert(event.shiftKey ? "outdent" : "insertChild");
			return;
		}
		if (event.key === "Enter" && event.shiftKey) {
			const node = this.editing ? this.doc.nodes.get(this.editing.nodeId) : void 0;
			if (node && (node.kind === "heading" || node.kind === "root")) {
				event.preventDefault();
				this.onError?.(new EditError("E_LABEL", "A heading label cannot contain a line break", node.id));
			}
		}
	}
	handleNotesKey(event) {
		const notes = this.notes;
		if (!notes) return;
		const target = event.target;
		if (!(target instanceof Node) || !notes.panel.contains(target)) {
			notes.field.focus({ preventScroll: true });
			return;
		}
		const mod = event.metaKey || event.ctrlKey;
		if (event.key === "Escape") {
			event.preventDefault();
			this.closeNotes();
			return;
		}
		if (event.key === "Enter" && mod) {
			event.preventDefault();
			this.commitNotes({ keepOpen: false });
			return;
		}
		if (mod && event.key.toLowerCase() === "b") {
			event.preventDefault();
			this.formatNotes("bold");
			return;
		}
		if (mod && event.key.toLowerCase() === "i") {
			event.preventDefault();
			this.formatNotes("italic");
		}
	}
	openNotes(node) {
		const doc = this.container.ownerDocument;
		const panel = doc.createElement("div");
		panel.className = "mm-editor-notes";
		panel.setAttribute("role", "dialog");
		panel.setAttribute("aria-label", "Notes");
		const header = doc.createElement("div");
		header.className = "mm-editor-notes-header";
		const icon = noteIcon(doc, NOTE_ICON);
		icon.classList.add("mm-editor-notes-icon");
		const title = doc.createElement("span");
		title.className = "mm-editor-notes-title";
		title.textContent = "Notes";
		const label = doc.createElement("span");
		label.className = "mm-editor-notes-label";
		label.textContent = "Markdown";
		header.append(icon, title, label);
		const toolbar = doc.createElement("div");
		toolbar.className = "mm-editor-notes-toolbar";
		toolbar.addEventListener("mousedown", (event) => event.preventDefault());
		for (const action of NOTE_ACTIONS) {
			const button = doc.createElement("button");
			button.type = "button";
			button.className = "mm-editor-notes-button";
			button.setAttribute("aria-label", action.name);
			button.setAttribute("title", action.name);
			button.append(noteIcon(doc, action.icon));
			button.addEventListener("click", () => this.formatNotes(action.format));
			toolbar.append(button);
		}
		const field = doc.createElement("textarea");
		field.className = "mm-editor-notes-field";
		field.setAttribute("aria-label", "Note text");
		field.spellcheck = false;
		field.value = notesText(this.doc, node);
		panel.append(header, toolbar, field);
		this.layer.append(panel);
		this.notes = {
			nodeId: node.id,
			original: field.value,
			panel,
			field
		};
		doc.addEventListener("mousedown", this.handleDocumentMouseDown);
		this.positionNotes();
		field.focus({ preventScroll: true });
		field.setSelectionRange(field.value.length, field.value.length);
	}
	handleDocumentMouseDown = (event) => {
		const notes = this.notes;
		if (!notes) return;
		const target = event.target;
		if (target instanceof Node && notes.panel.contains(target)) return;
		this.commitNotes({ keepOpen: false });
	};
	closeNotes(focus = true) {
		const notes = this.notes;
		if (!notes) return;
		this.container.ownerDocument.removeEventListener("mousedown", this.handleDocumentMouseDown);
		notes.panel.remove();
		this.notes = null;
		if (focus && !this.destroyed) this.container.focus({ preventScroll: true });
	}
	commitNotes(options) {
		const notes = this.notes;
		if (!notes) return "none";
		const text = notes.field.value;
		if (text === notes.original) {
			if (!options.keepOpen) this.closeNotes();
			return "none";
		}
		const before = this.snapshot();
		const result = this.apply({
			type: "setNotes",
			node: notes.nodeId,
			text
		});
		if (!result) return "error";
		notes.original = text;
		if (result.edits.length) this.history.push(before);
		if (options.keepOpen) {
			notes.field.focus({ preventScroll: true });
			this.positionNotes();
		} else this.closeNotes();
		return result.edits.length ? "changed" : "none";
	}
	positionNotes() {
		const notes = this.notes;
		if (!notes) return;
		const rect = this.view.screenRect(notes.nodeId);
		if (!rect) {
			this.closeNotes();
			return;
		}
		const box = this.container.getBoundingClientRect();
		const margin = 8;
		const width = Math.max(0, Math.min(400, box.width - 16));
		notes.panel.style.width = `${width}px`;
		notes.panel.style.maxHeight = `${Math.max(80, box.height / 2)}px`;
		const height = notes.panel.getBoundingClientRect().height || 220;
		const below = rect.y + rect.height + margin;
		const above = rect.y - margin - height;
		const preferred = below + height <= box.y + box.height ? below : above;
		const top = Math.max(box.y + margin, Math.min(preferred, box.y + box.height - margin - height));
		const left = Math.max(box.x + margin, Math.min(rect.x + rect.width / 2 - width / 2, box.x + box.width - margin - width));
		notes.panel.style.left = `${left - box.x}px`;
		notes.panel.style.top = `${top - box.y}px`;
	}
	formatNotes(format) {
		const notes = this.notes;
		if (!notes) return;
		const field = notes.field;
		const start = field.selectionStart;
		const end = field.selectionEnd;
		const value = field.value;
		const selected = value.slice(start, end);
		if (format === "bold") {
			this.wrapNotes(field, "**", "**");
			return;
		}
		if (format === "italic") {
			this.wrapNotes(field, "_", "_");
			return;
		}
		if (format === "code") {
			const run = "`".repeat(backtickRun(selected));
			this.wrapNotes(field, run, run);
			return;
		}
		if (format === "link") {
			const url = start + selected.length + 3;
			field.value = `${value.slice(0, start)}[${selected}](url)${value.slice(end)}`;
			field.focus({ preventScroll: true });
			field.setSelectionRange(url, url + 3);
			this.positionNotes();
			return;
		}
		if (format === "quote") {
			if (!selected) {
				const from = value.lastIndexOf("\n", start - 1) + 1;
				const caret = start + 2;
				field.value = `${value.slice(0, from)}> ${value.slice(from)}`;
				field.focus({ preventScroll: true });
				field.setSelectionRange(caret, caret);
				this.positionNotes();
				return;
			}
			const from = value.lastIndexOf("\n", start - 1) + 1;
			const lineEnd = value.indexOf("\n", end);
			const to = lineEnd === -1 ? value.length : lineEnd;
			const quoted = value.slice(from, to).split("\n").map((line) => `> ${line}`).join("\n");
			field.value = value.slice(0, from) + quoted + value.slice(to);
			field.focus({ preventScroll: true });
			field.setSelectionRange(from, from + quoted.length);
			this.positionNotes();
			return;
		}
		const fence = "`".repeat(Math.max(3, backtickRun(selected)));
		const body = selected ? `${fence}\n${selected}${selected.endsWith("\n") ? "" : "\n"}${fence}` : `${fence}\n\n${fence}`;
		const caret = start + fence.length + 1;
		field.value = value.slice(0, start) + body + value.slice(end);
		field.focus({ preventScroll: true });
		field.setSelectionRange(caret, caret);
		this.positionNotes();
	}
	wrapNotes(field, prefix, suffix) {
		const start = field.selectionStart;
		const end = field.selectionEnd;
		const value = field.value;
		const selected = value.slice(start, end);
		field.value = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;
		const caret = start + prefix.length;
		field.focus({ preventScroll: true });
		field.setSelectionRange(caret, selected ? caret + selected.length : caret);
		this.positionNotes();
	}
	insertAndEdit(kind) {
		const id = this.selectedId;
		if (!id) return;
		const node = this.doc.nodes.get(id);
		if (!node) return;
		if (kind === "insertSibling" && node.kind === "root") {
			if (this.isEmptyRoot(node)) {
				this.startEditing(id, { selectAll: true });
				return;
			}
			kind = "insertChild";
		}
		const result = this.run({
			type: kind,
			node: id,
			text: this.placeholder
		});
		if (result) this.editCreated(result);
	}
	editCreated(result) {
		const created = nodeAtOffset(result.document, result.selection);
		if (!created) return;
		this.select(created.id);
		this.startEditing(created.id, { selectAll: true });
	}
	runSelected(command) {
		const id = this.selectedId;
		if (!id) return null;
		return this.run({
			...command,
			node: id
		});
	}
	run(command) {
		const before = this.snapshot();
		const result = this.apply(command);
		if (result) this.history.push(before);
		return result;
	}
	apply(command) {
		const folds = this.captureFolds(this.doc);
		const editing = this.editing;
		try {
			const result = applyCommand(this.doc, command);
			this.doc = result.document;
			if (!result.edits.length) return result;
			if (editing && command.type === "setLabel" && command.node === editing.nodeId) {
				const target = nodeAtOffset(result.document, result.selection);
				if (target) {
					editing.nodeId = target.id;
					editing.previewId = target.id;
				}
			}
			this.view.setTree(result.tree);
			this.restoreFolds(folds, result);
			this.selectAt(result.selection, { reveal: false });
			if (command.type === "setNotes") this.select(command.node, { reveal: false });
			this.emitChange();
			return result;
		} catch (error) {
			this.onError?.(error instanceof Error ? error : new Error(String(error)));
			return null;
		}
	}
	commitEditing(options = {}) {
		const editing = this.editing;
		if (!editing) return "none";
		const text = editing.field.value;
		if (text === editing.original || editing.blank && text === "") {
			this.stopEditingUi();
			return "none";
		}
		const before = this.snapshot();
		if (!(editing.first ? this.apply({
			type: "insertFirst",
			node: editing.nodeId,
			text
		}) : this.apply({
			type: "setLabel",
			node: editing.nodeId,
			text
		}))) return "error";
		if (options.history !== false) this.history.push(before);
		this.stopEditingUi(false);
		return "changed";
	}
	cancelEditing() {
		this.stopEditingUi();
	}
	commitAndInsert(kind) {
		const before = this.snapshot();
		const state = this.commitEditing({ history: false });
		if (state === "error") return;
		const node = this.selectedNode();
		if (!node) return;
		if (kind === "outdent") {
			if (this.apply({
				type: "outdent",
				node: node.id
			}) || state === "changed") this.history.push(before);
			return;
		}
		const result = this.apply({
			type: kind,
			node: node.id,
			text: this.placeholder
		});
		if (result || state === "changed") this.history.push(before);
		if (result) this.editCreated(result);
	}
	previewEditing() {
		const editing = this.editing;
		if (!editing) return;
		const text = editing.field.value;
		if (text === editing.original || editing.blank && text === "") {
			this.restorePreview(editing);
			return;
		}
		const folds = this.captureFolds(this.doc);
		try {
			const result = applyCommand(this.doc, editing.first ? {
				type: "insertFirst",
				node: editing.nodeId,
				text
			} : {
				type: "setLabel",
				node: editing.nodeId,
				text
			});
			this.previewing = true;
			try {
				this.view.setTree(result.tree);
				this.restoreFolds(folds, result);
			} finally {
				this.previewing = false;
			}
			editing.previewId = nodeAtOffset(result.document, result.selection)?.id ?? editing.previewId;
			editing.preview = true;
		} catch {
			this.previewing = false;
		}
	}
	restorePreview(editing) {
		if (!editing.preview) return;
		const parsed = parseDocument(this.doc.source);
		this.previewing = true;
		try {
			this.view.setTree(parsed.tree);
			this.view.setFoldedIds(editing.folds, { animate: false });
		} finally {
			this.previewing = false;
		}
		editing.preview = false;
		editing.previewId = editing.nodeId;
		this.selectedId = editing.nodeId;
	}
	setMode(editing) {
		this.container.classList.toggle(MODE_EDIT, editing);
		this.container.classList.toggle(MODE_SELECT, !editing);
	}
	stopEditingUi(restore = true) {
		if (!this.editing) return;
		if (restore) this.restorePreview(this.editing);
		this.editing.field.style.display = "none";
		this.editing = null;
		this.setMode(false);
		this.paintEditing();
		this.paintSelection();
		this.container.focus({ preventScroll: true });
	}
	positionEditing() {
		const editing = this.editing;
		if (!editing) return;
		const rect = this.view.screenRect(editing.previewId);
		if (!rect) {
			this.stopEditingUi();
			return;
		}
		const box = this.container.getBoundingClientRect();
		const field = editing.field;
		const scale = this.view.scale;
		const fontSize = Number.parseFloat(getComputedStyle(field).fontSize) || 16;
		const lineHeight = 20;
		const context = field.ownerDocument.createElement("canvas").getContext("2d");
		if (context) context.font = getComputedStyle(field).font;
		const textWidth = field.value.split("\n").reduce((max, line) => {
			if (!context) return Math.max(max, line.length * fontSize * .85);
			return Math.max(max, context.measureText(line).width);
		}, 0) + 16;
		const width = Math.max(rect.width / scale, textWidth, 40);
		const rows = field.value.split("\n").length;
		const direction = this.view.direction(editing.previewId);
		const align = direction === "left" ? "right" : direction === "top" || direction === "bottom" ? "center" : "left";
		const left = align === "center" ? rect.x + rect.width / 2 - width * scale / 2 : align === "right" ? rect.x + rect.width - width * scale : rect.x;
		field.style.left = `${left - box.x}px`;
		field.style.top = `${rect.y - box.y}px`;
		field.style.width = `${width}px`;
		field.style.height = `${Math.max(1, rect.height / scale, rows * lineHeight)}px`;
		field.style.textAlign = align;
		field.style.transform = `scale(${scale})`;
	}
	navigate(key) {
		const node = this.selectedNode();
		if (!node) return;
		if (key === "ArrowUp" || key === "ArrowDown") {
			const parent = node.parent ? this.doc.nodes.get(node.parent) : void 0;
			if (!parent) return;
			const index = parent.children.indexOf(node.id);
			const next = parent.children[index + (key === "ArrowUp" ? -1 : 1)];
			if (next) this.select(next);
			return;
		}
		if (key === "ArrowLeft") {
			if (node.parent) this.select(node.parent);
			return;
		}
		if (this.view.foldedIds.has(node.id)) {
			this.view.setFolded(node.id, false);
			return;
		}
		const child = node.children[0];
		if (child) this.select(child);
	}
	selectAt(offset, options = {}) {
		this.selectionOffset = offset;
		const node = nodeAtOffset(this.doc, offset);
		const fallback = this.doc.nodes.size === 1 ? this.doc.root : null;
		this.select(node?.id ?? fallback, options);
	}
	select(id, options = {}) {
		this.selectedId = id;
		this.paintSelection();
		if (id && options.reveal !== false) this.ensureVisible(id);
	}
	ensureVisible(id) {
		const rect = this.view.screenRect(id);
		const box = this.container.getBoundingClientRect();
		if (!rect) {
			this.view.focusNode(id, { animate: false });
			return;
		}
		const margin = 8;
		if (rect.x < box.x + margin || rect.y < box.y + margin || rect.x + rect.width > box.x + box.width - margin || rect.y + rect.height > box.y + box.height - margin) this.view.focusNode(id, { animate: false });
	}
	selectedNode() {
		return this.selectedId ? this.doc.nodes.get(this.selectedId) : void 0;
	}
	isEmptyRoot(node) {
		return node?.kind === "root" && !node.block && !node.label && this.doc.nodes.size === 1 && !this.title;
	}
	isEmptyLabel(node) {
		return this.isEmptyRoot(node) || node !== void 0 && labelText(this.doc, node) === EMPTY_LABEL;
	}
	snapshot() {
		return {
			source: this.doc.source,
			selection: this.selectionOffset,
			folded: [...this.view.foldedIds]
		};
	}
	restore(entry) {
		const parsed = parseDocument(entry.source);
		this.closeNotes(false);
		this.stopEditingUi(false);
		this.doc = parsed.document;
		this.title = typeof parsed.frontmatter.title === "string" ? parsed.frontmatter.title : "";
		this.view.setTree(parsed.tree);
		this.view.setFoldedIds(entry.folded, { animate: false });
		this.selectAt(entry.selection, { reveal: false });
		this.emitChange();
	}
	captureFolds(doc) {
		const anchors = [];
		for (const id of this.view.foldedIds) {
			const node = doc.nodes.get(id);
			if (node?.block) anchors.push({ offset: node.block.start });
		}
		return anchors;
	}
	restoreFolds(anchors, result) {
		const ids = /* @__PURE__ */ new Set();
		for (const anchor of anchors) {
			if (result.edits.some((edit) => anchor.offset >= edit.from && anchor.offset < edit.to)) continue;
			const offset = mapOffset(result.edits, anchor.offset);
			const node = nodeAtOffset(result.document, offset);
			if (node?.block?.start === offset) ids.add(node.id);
		}
		if (!ids.size) return;
		this.view.setFoldedIds(/* @__PURE__ */ new Set([...this.view.foldedIds, ...ids]), { animate: false });
	}
	paintSelection() {
		this.view.element.querySelectorAll(".mm-editor-selected").forEach((element) => {
			element.classList.remove("mm-editor-selected");
		});
		const id = this.editing?.previewId ?? this.selectedId;
		if (!id) {
			this.selectionBox.style.display = "none";
			return;
		}
		const selected = this.doc.nodes.get(id);
		if (!this.editing && this.isEmptyRoot(selected)) {
			this.selectionBox.style.display = "none";
			return;
		}
		this.nodeGroup(id)?.classList.add("mm-editor-selected");
		if (this.drag?.active) {
			this.selectionBox.style.display = "none";
			return;
		}
		const rect = this.editing ? this.editing.field.getBoundingClientRect() : this.view.screenRect(id);
		const box = this.container.getBoundingClientRect();
		if (!rect) {
			this.selectionBox.style.display = "none";
			return;
		}
		this.selectionBox.style.display = "block";
		this.selectionBox.style.left = `${rect.x - box.x - 2}px`;
		this.selectionBox.style.top = `${rect.y - box.y - 2}px`;
		this.selectionBox.style.width = `${rect.width + 4}px`;
		this.selectionBox.style.height = `${rect.height + 4}px`;
	}
	paintEditing() {
		this.view.element.querySelectorAll(".mm-editor-editing").forEach((element) => {
			element.classList.remove("mm-editor-editing");
		});
		if (this.editing) this.nodeGroup(this.editing.previewId)?.classList.add("mm-editor-editing");
	}
	nodeGroup(id) {
		return this.view.element.querySelector(`[data-key="node:${id}"]`);
	}
	hitAt(event) {
		const [x, y] = this.view.layoutPoint(event.clientX, event.clientY);
		return this.view.hitAt(x, y);
	}
	emitChange() {
		this.onChange?.({
			source: this.doc.source,
			selection: this.selectionOffset,
			document: this.doc
		});
	}
};
// src/view.ts
function createEditView(mm) {
	return {
		element: mm.element,
		get scale() {
			return mm.transform.k;
		},
		get transform() {
			return {
				k: mm.transform.k,
				x: mm.transform.x,
				y: mm.transform.y
			};
		},
		panBy: (dx, dy) => {
			const { k } = mm.transform;
			mm.zoomBehavior.transform(select(mm.element), mm.transform.translate(dx / k, dy / k));
		},
		get foldedIds() {
			return mm.foldedIds;
		},
		setTree: (root) => mm.setTree(root),
		setFolded: (id, folded) => mm.setFolded(id, folded),
		setFoldedIds: (ids, options) => mm.setFoldedIds(ids, options),
		toggle: (id) => mm.toggle(id),
		focusNode: (id, options) => mm.focusNode(id, options),
		screenRect: (id) => mm.screenRect(id),
		direction: (id) => mm.result?.layout.byId.get(id)?.direction,
		hitAt: (x, y) => mm.hitAt(x, y),
		layoutPoint: (x, y) => mm.layoutPoint(x, y),
		on: (type, listener) => mm.on(type, listener)
	};
}
export { History, MarkmapEditor, createEditView };
