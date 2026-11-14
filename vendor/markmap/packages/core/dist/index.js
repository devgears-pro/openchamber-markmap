// src/geometry.ts
function translate(x, y) {
	return [
		1,
		0,
		0,
		1,
		x,
		y
	];
}
/** Scale by `k` around the point (`cx`, `cy`). */
function scaleAround(k, cx, cy) {
	return [
		k,
		0,
		0,
		k,
		cx * (1 - k),
		cy * (1 - k)
	];
}
/** `a` applied after `b`, as in SVG `transform="matrix(a) matrix(b)"`. */
function multiply(a, b) {
	const [a0, a1, a2, a3, a4, a5] = a;
	const [b0, b1, b2, b3, b4, b5] = b;
	return [
		a0 * b0 + a2 * b1,
		a1 * b0 + a3 * b1,
		a0 * b2 + a2 * b3,
		a1 * b2 + a3 * b3,
		a0 * b4 + a2 * b5 + a4,
		a1 * b4 + a3 * b5 + a5
	];
}
function unionRects(rects) {
	let [x0, y0, x1, y1] = [
		Infinity,
		Infinity,
		-Infinity,
		-Infinity
	];
	for (const r of rects) {
		x0 = Math.min(x0, r.x);
		y0 = Math.min(y0, r.y);
		x1 = Math.max(x1, r.x + r.width);
		y1 = Math.max(y1, r.y + r.height);
	}
	if (x0 > x1) return {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	};
	return {
		x: x0,
		y: y0,
		width: x1 - x0,
		height: y1 - y0
	};
}
function expandRect(rect, by) {
	return {
		x: rect.x - by,
		y: rect.y - by,
		width: rect.width + by * 2,
		height: rect.height + by * 2
	};
}
var OPPOSITE = {
	left: "right",
	right: "left",
	top: "bottom",
	bottom: "top"
};
function oppositeSide(side) {
	return OPPOSITE[side];
}
// src/tree.ts
/** Visit every node in pre-order. */
function walkTree(root, visitor) {
	const visit = (node, parent, depth) => {
		if (visitor(node, parent, depth) === false) return;
		for (const child of node.children) visit(child, node, depth + 1);
	};
	visit(root, void 0, 0);
}
/** Return the path from the root to the node with `id`, both included, or `undefined`. */
function findPath(root, id) {
	if (root.id === id) return [root];
	for (const child of root.children) {
		const path = findPath(child, id);
		if (path) return [root, ...path];
	}
}
function findNode(root, id) {
	return findPath(root, id)?.at(-1);
}
/** Plain text of inline content, as used for ids, search and accessibility labels. */
function toPlainText(content) {
	let text = "";
	for (const node of content) if ("value" in node) text += node.value;
	else if (node.type === "image" || node.type === "imageReference") text += node.alt ?? "";
	else if (node.type === "break") text += "\n";
	else if ("children" in node) text += toPlainText(node.children);
	return text;
}
// src/id.ts
var ROOT_ID = "root";
/** 32-bit FNV-1a hash of a string, in base 36. */
function hashString(input) {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36).padStart(7, "0");
}
/**
* Assign stable ids in place. The root is always `root`. Every other id is a hash of
* the parent id and the node's plain text, so ids survive edits elsewhere in the
* document. Siblings with the same text are told apart by their occurrence index.
*/
function assignIds(root) {
	const assign = (node, id) => {
		node.id = id;
		const seen = /* @__PURE__ */ new Map();
		for (const child of node.children) {
			const text = toPlainText(child.content);
			const index = seen.get(text) ?? 0;
			seen.set(text, index + 1);
			assign(child, hashString(`${id}\0${text}${index ? `\0${index}` : ""}`));
		}
	};
	assign(root, ROOT_ID);
	return root;
}
// src/options.ts
/**
* A CSS value that cannot break out of a declaration or a `<style>` element.
* Colors from Markdown end up in embedded CSS, so they must pass this check.
*/
function isSafeCSSValue(value) {
	return value.length > 0 && value.length <= 100 && !/[;{}<>\\'"]|\/\*/.test(value);
}
var validators = {
	number(min, integer = false) {
		return (value, key) => {
			if (typeof value !== "number" || !Number.isFinite(value)) return { warning: `\`${key}\` must be a number` };
			if (value < min || integer && !Number.isInteger(value)) return { warning: `\`${key}\` must be ${integer ? "an integer " : ""}>= ${min}` };
			return { value };
		};
	},
	/** A short non-empty string, such as a name to look up. */
	string() {
		return (value, key) => typeof value === "string" && value.trim() && value.length <= 100 ? { value: value.trim() } : { warning: `\`${key}\` must be a non-empty string` };
	},
	oneOf(values) {
		return (value, key) => values.includes(value) ? { value } : { warning: `\`${key}\` must be one of ${values.map((v) => `\`${v}\``).join(", ")}` };
	},
	boolean() {
		return (value, key) => typeof value === "boolean" ? { value } : { warning: `\`${key}\` must be true or false` };
	},
	/** One CSS color or a list of them; always normalized to a list. Unsafe values are dropped. */
	colors() {
		return (value, key) => {
			const colors = typeof value === "string" ? [value] : value;
			if (!Array.isArray(colors) || !colors.length) return { warning: `\`${key}\` must be a color or a list of colors` };
			const safe = colors.filter((c) => typeof c === "string" && isSafeCSSValue(c.trim())).map((c) => c.trim());
			return {
				value: safe.length ? safe : void 0,
				warning: safe.length < colors.length ? `\`${key}\` has invalid colors, which were ignored` : void 0
			};
		};
	}
};
var CORE_SCHEMA = {
	foldLevel: validators.number(0, true),
	wrapWidth: validators.number(0),
	levelGap: validators.number(0),
	siblingGap: validators.number(0),
	zoom: validators.boolean(),
	pan: validators.boolean(),
	fitPadding: validators.number(0),
	fitMaxScale: validators.number(.01),
	minScale: validators.number(.001),
	maxScale: validators.number(.01),
	duration: validators.number(0),
	layout: validators.string(),
	theme: validators.string(),
	colorScheme: validators.oneOf([
		"light",
		"dark",
		"auto"
	])
};
/** Validate untrusted options against a schema. */
function validateOptions(input, schema) {
	const options = {};
	const rest = {};
	const warnings = [];
	if (input == null) return {
		options,
		rest,
		warnings
	};
	if (typeof input !== "object" || Array.isArray(input)) return {
		options,
		rest,
		warnings: ["`markmap` options must be an object"]
	};
	for (const [key, raw] of Object.entries(input)) {
		const validate = Object.hasOwn(schema, key) ? schema[key] : void 0;
		if (!validate) {
			rest[key] = raw;
			continue;
		}
		const { value, warning } = validate(raw, key);
		if (warning) warnings.push(warning);
		if (value !== void 0) options[key] = value;
	}
	return {
		options,
		rest,
		warnings
	};
}
/** Validate the theme-independent options. Theme keys are returned in `rest`. */
function readJSONOptions(input) {
	return validateOptions(input, CORE_SCHEMA);
}
/** Warnings for keys that no schema claimed. */
function unknownOptionWarnings(rest) {
	return Object.keys(rest).map((key) => `Unknown option \`${key}\``);
}
export { ROOT_ID, assignIds, expandRect, findNode, findPath, hashString, isSafeCSSValue, multiply, oppositeSide, readJSONOptions, scaleAround, toPlainText, translate, unionRects, unknownOptionWarnings, validateOptions, validators, walkTree };
