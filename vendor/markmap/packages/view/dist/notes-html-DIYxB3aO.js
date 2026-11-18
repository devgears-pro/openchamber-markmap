import { defaultSchema, sanitize } from "hast-util-sanitize";
import { toHtml } from "hast-util-to-html";
import { toHast } from "mdast-util-to-hast";
// src/hast-utils.ts
/** Languages named by `<pre><code class="language-…">` blocks. */
function codeLanguages(tree) {
	const languages = [];
	for (const pre of walkElements(tree, "pre")) {
		const lang = languageOf(pre.children.find((c) => c.type === "element"));
		if (lang) languages.push(lang);
	}
	return languages;
}
function languageOf(code) {
	if (code?.tagName !== "code") return void 0;
	const classes = code.properties.className;
	const name = (Array.isArray(classes) ? classes : []).find((c) => typeof c === "string" && c.startsWith("language-"));
	return typeof name === "string" ? name.slice(9) : void 0;
}
function* walkElements(node, tagName) {
	for (const child of node.children) {
		if (child.type !== "element") continue;
		if (child.tagName === tagName) yield child;
		yield* walkElements(child, tagName);
	}
}
// src/notes-html.ts
var schema = {
	...defaultSchema,
	tagNames: [...defaultSchema.tagNames ?? [], "mark"],
	protocols: {
		...defaultSchema.protocols,
		src: [...defaultSchema.protocols?.src ?? [], "data"]
	},
	clobberPrefix: "mm-"
};
/**
* Render note blocks as HTML: Markdown to HTML, sanitized, then code highlighting
* and plugin hooks, which may add trusted markup. Loaded on demand by the view, and
* the highlighter only when a code block names a language, so neither weighs on the
* initial bundle.
*/
async function notesToHtml(notes, options = {}) {
	const mdast = {
		type: "root",
		children: notes.map((a) => a.block)
	};
	const hast = toHast(mdast, { handlers: { mark: (state, node) => ({
		type: "element",
		tagName: "mark",
		properties: {},
		children: state.all(node)
	}) } });
	const clean = sanitize(hast, schema);
	for (const link of walkElements(clean, "a")) {
		link.properties.target = "_blank";
		link.properties.rel = ["noopener", "noreferrer"];
	}
	if (options.highlight !== false && codeLanguages(clean).length) {
		const { highlightCode } = await import("./highlight-C7UPduaR.js");
		highlightCode(clean);
	}
	for (const plugin of options.plugins ?? []) await plugin.popover?.(clean);
	return toHtml(clean, { allowDangerousHtml: true });
}
export { walkElements as n, notesToHtml, languageOf as t };
