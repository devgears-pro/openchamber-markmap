import { EditError, applyCommand, mapOffset } from "@markmap/edit";
import { labelText, nodeAtOffset, parseDocument } from "@markmap/model";
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
var EMPTY_LABEL = "​";
var STYLE = `
.mm-editor-layer{position:absolute;inset:0;pointer-events:none;z-index:2}
.mm-editor-field{position:absolute;display:none;margin:0;padding:0 8px;border:0;background:transparent;color:inherit;font:inherit;line-height:1.25;text-align:center;white-space:pre-wrap;resize:none;overflow:hidden;outline:none;box-sizing:border-box;pointer-events:auto;transform-origin:top left}
.mm-editor-selection{position:absolute;display:none;pointer-events:none;box-sizing:border-box;border:2px solid var(--oc-focus,#0097e6);border-radius:6px}
.mm-editor-editing text{visibility:hidden}
`;
var styleUsers = /* @__PURE__ */ new WeakMap();
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
var MarkmapEditor = class {
	view;
	container;
	field;
	selectionBox;
	layer;
	history = new History();
	onChange;
	onError;
	placeholder;
	restorePosition;
	restoreTabIndex;
	stops = [];
	doc;
	selectedId = null;
	selectionOffset = 0;
	editing = null;
	destroyed = false;
	constructor({ source, view, container, placeholder, onChange, onError }) {
		this.view = view;
		this.container = container;
		this.doc = parseDocument(source).document;
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
		this.field = doc.createElement("textarea");
		this.field.className = "mm-editor-field";
		this.field.spellcheck = false;
		this.field.autocomplete = "off";
		this.field.setAttribute("autocapitalize", "off");
		this.field.setAttribute("wrap", "soft");
		this.field.addEventListener("input", this.handleInput);
		this.layer.append(this.selectionBox, this.field);
		container.append(this.layer);
		container.addEventListener("keydown", this.handleKeyDown);
		container.addEventListener("click", this.handleClick);
		container.addEventListener("dblclick", this.handleDoubleClick);
		this.stops.push(this.view.on("render", this.handleViewChange));
		this.stops.push(this.view.on("zoom", this.handleViewChange));
		this.selectedId = this.doc.root;
		this.selectionOffset = this.doc.nodes.get(this.doc.root)?.label?.start ?? 0;
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
		this.stopEditingUi();
		this.doc = parsed.document;
		this.history.clear();
		this.view.setTree(parsed.tree);
		const offset = options.selection ?? this.doc.nodes.get(this.doc.root)?.label?.start ?? 0;
		if (options.selection == null) {
			this.selectionOffset = offset;
			this.select(this.doc.root, { reveal: false });
		} else this.selectAt(offset, { reveal: false });
		if (options.emit) this.emitChange();
	}
	startEditing(nodeId = this.selectedId, initialText, options = {}) {
		if (!nodeId) return;
		if (this.editing) {
			if (this.editing.nodeId === nodeId) return;
			if (this.commitEditing() === "error") return;
		}
		const node = this.doc.nodes.get(nodeId);
		const first = this.isEmptyRoot(node);
		if (!node || !node.label && !first) return;
		if (!this.view.screenRect(nodeId)) return;
		const label = node.label ? labelText(this.doc, node) : "";
		const blank = first || label === EMPTY_LABEL;
		const text = initialText ?? (blank ? "" : label);
		this.field.value = text;
		this.field.style.display = "block";
		this.editing = {
			nodeId,
			original: label,
			blank,
			first,
			field: this.field
		};
		this.paintEditing();
		this.positionEditing();
		this.paintSelection();
		this.field.focus({ preventScroll: true });
		if (options.selectAll) this.field.select();
		else this.field.setSelectionRange(text.length, text.length);
	}
	commit() {
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
		this.field.removeEventListener("input", this.handleInput);
		this.layer.remove();
		releaseStyle(this.container.ownerDocument);
		if (this.restorePosition) this.container.style.position = "";
		if (this.restoreTabIndex) this.container.removeAttribute("tabindex");
		this.editing = null;
		this.selectedId = null;
	}
	handleInput = () => {
		if (!this.editing) return;
		this.positionEditing();
		this.paintSelection();
	};
	handleViewChange = () => {
		if (this.editing) this.positionEditing();
		this.paintSelection();
		this.paintEditing();
	};
	handleClick = (event) => {
		const target = event.target;
		if (this.editing && target && this.editing.field.contains(target)) return;
		if (event.button !== 0) return;
		if (this.editing && this.commitEditing() === "error") return;
		const hit = this.hitAt(event);
		if ((hit?.kind === "node" || hit?.kind === "toggle") && hit.nodeId) {
			this.select(hit.nodeId, { reveal: false });
			this.container.focus({ preventScroll: true });
		}
	};
	handleDoubleClick = (event) => {
		if (this.editing) return;
		const hit = this.hitAt(event);
		if (hit?.kind === "node" && hit.nodeId) {
			this.select(hit.nodeId, { reveal: false });
			this.startEditing(hit.nodeId);
			event.preventDefault();
		}
	};
	handleKeyDown = (event) => {
		if (event.defaultPrevented) return;
		if (event.isComposing || event.keyCode === 229) return;
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
			case "F2":
			case " ":
				event.preventDefault();
				this.startEditing();
				return;
			case "Escape":
				event.preventDefault();
				this.select(null);
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
				this.startEditing(this.selectedId, `${this.selectedLabel()}${event.key}`);
				event.preventDefault();
		}
	};
	handleEditingKey(event) {
		if (event.isComposing || event.keyCode === 229) return;
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
			if (this.editing && this.editing.field.value === this.editing.original) {
				event.preventDefault();
				this.stopEditingUi();
				if (event.shiftKey) this.redo();
				else this.undo();
			}
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			this.cancelEditing();
			return;
		}
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			this.commitAndInsert("insertSibling");
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
	insertAndEdit(kind) {
		const id = this.selectedId;
		if (!id) return;
		const node = this.doc.nodes.get(id);
		if (!node) return;
		if (kind === "insertSibling" && node.kind === "root") {
			if (this.isEmptyRoot(node)) {
				this.startEditing(id, "", { selectAll: true });
				return;
			}
			kind = "insertChild";
		}
		const result = this.run({
			type: kind,
			node: id,
			text: this.placeholder
		});
		if (!result) return;
		const created = nodeAtOffset(result.document, result.selection);
		if (created) {
			this.select(created.id);
			this.startEditing(created.id, void 0, { selectAll: true });
		}
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
			if (editing && command.type === "setLabel" && command.node === editing.nodeId) {
				const target = nodeAtOffset(result.document, result.selection);
				if (target) editing.nodeId = target.id;
			}
			this.view.setTree(result.tree);
			this.restoreFolds(folds, result);
			this.selectAt(result.selection, { reveal: false });
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
		this.stopEditingUi();
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
			type: kind === "insertSibling" && node.kind === "root" ? "insertChild" : kind,
			node: node.id,
			text: this.placeholder
		});
		if (result || state === "changed") this.history.push(before);
		if (!result) return;
		const created = nodeAtOffset(result.document, result.selection);
		if (created) {
			this.select(created.id);
			this.startEditing(created.id, void 0, { selectAll: true });
		}
	}
	stopEditingUi() {
		if (!this.editing) return;
		this.editing.field.style.display = "none";
		this.editing = null;
		this.paintEditing();
		this.paintSelection();
		this.container.focus({ preventScroll: true });
	}
	positionEditing() {
		const editing = this.editing;
		if (!editing) return;
		const rect = this.view.screenRect(editing.nodeId);
		if (!rect) {
			this.stopEditingUi();
			return;
		}
		const box = this.container.getBoundingClientRect();
		const field = editing.field;
		const scale = this.view.scale;
		const fontSize = Number.parseFloat(getComputedStyle(field).fontSize) || 16;
		const lineHeight = 20;
		const textWidth = field.value.length * fontSize * .85 + 16;
		const width = Math.max(rect.width / scale, textWidth, 40);
		const rows = field.value.split("\n").length;
		field.style.left = `${rect.x - box.x}px`;
		field.style.top = `${rect.y - box.y}px`;
		field.style.width = `${width}px`;
		field.style.height = `${Math.max(1, rect.height / scale, rows * lineHeight)}px`;
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
			if (node.children.length && !this.view.foldedIds.has(node.id)) {
				this.view.setFolded(node.id, true);
				return;
			}
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
	selectedLabel() {
		const node = this.selectedNode();
		if (!node) return "";
		const label = labelText(this.doc, node);
		return label === EMPTY_LABEL ? "" : label;
	}
	isEmptyRoot(node) {
		return node?.kind === "root" && !node.block && !node.label && this.doc.nodes.size === 1;
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
		this.stopEditingUi();
		this.doc = parsed.document;
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
		if (!this.selectedId) {
			this.selectionBox.style.display = "none";
			return;
		}
		const selected = this.doc.nodes.get(this.selectedId);
		if (!this.editing && this.isEmptyRoot(selected)) {
			this.selectionBox.style.display = "none";
			return;
		}
		this.nodeGroup(this.selectedId)?.classList.add("mm-editor-selected");
		const rect = this.editing ? this.editing.field.getBoundingClientRect() : this.view.screenRect(this.selectedId);
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
		if (this.editing) this.nodeGroup(this.editing.nodeId)?.classList.add("mm-editor-editing");
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
		get foldedIds() {
			return mm.foldedIds;
		},
		setTree: (root) => mm.setTree(root),
		setFolded: (id, folded) => mm.setFolded(id, folded),
		setFoldedIds: (ids, options) => mm.setFoldedIds(ids, options),
		toggle: (id) => mm.toggle(id),
		focusNode: (id, options) => mm.focusNode(id, options),
		screenRect: (id) => mm.screenRect(id),
		hitAt: (x, y) => mm.hitAt(x, y),
		layoutPoint: (x, y) => mm.layoutPoint(x, y),
		on: (type, listener) => mm.on(type, listener)
	};
}
export { History, MarkmapEditor, createEditView };
