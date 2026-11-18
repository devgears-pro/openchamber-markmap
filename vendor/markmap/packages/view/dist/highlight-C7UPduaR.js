import { n as walkElements, t as languageOf } from "./notes-html-DIYxB3aO.js";
import { toText } from "hast-util-to-text";
import { common, createLowlight } from "lowlight";
// src/highlight.ts
var lowlight = createLowlight(common);
/**
* Color `<pre><code class="language-…">` blocks in place with highlight.js classes
* (`hljs-keyword`, …). Unknown languages are left as they are. The tree must already be
* sanitized: the highlighter only adds spans around the code's own text.
*/
function highlightCode(tree) {
	for (const pre of walkElements(tree, "pre")) {
		const code = pre.children.find((c) => c.type === "element");
		const lang = languageOf(code);
		if (!code || !lang || !lowlight.registered(lang)) continue;
		code.children = lowlight.highlight(lang, toText(code, { whitespace: "pre" })).children;
		code.properties.className = [...code.properties.className, "hljs"];
	}
}
export { highlightCode };
