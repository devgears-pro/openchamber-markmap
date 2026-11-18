export const STYLE_ID = 'markmap-styles';

const MARKMAP_CSS = `
  html, body, #root { height: 100%; }
  html, body {
    margin: 0;
    background: var(--oc-bg, #1b1b1f);
    color: var(--oc-fg, #ececf1);
    font-family: var(--oc-font, system-ui, -apple-system, "Segoe UI", sans-serif);
    font-size: 13px;
  }
  .mm-stage {
    position: absolute;
    inset: 0;
    display: flex;
    overflow: hidden;
    background: var(--oc-bg, #1b1b1f);
  }
  .mm-editor-surface {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    color: var(--oc-fg, #ececf1);
    font: 400 16px/20px var(--oc-font, system-ui, -apple-system, "Segoe UI", sans-serif);
    outline: none;
  }
  .mm-markmap-svg {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--oc-bg, #1b1b1f);
    --mm-edge-relation: var(--oc-muted, #8b949e);
    --mm-edge-relation-label: var(--oc-fg, #ececf1);
  }
  .mm-markmap-toolbar {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--oc-border, #34343c);
    border-radius: calc(var(--oc-radius, 9px) - 1px);
    background: var(--oc-elevated, #25252c);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
  }
  .mm-markmap-toolbar > .markmap-toolbar {
    gap: 2px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--oc-muted, #8d8d99);
    font: 12px/1.2 var(--oc-font, system-ui, -apple-system, "Segoe UI", sans-serif);
  }
  .mm-markmap-toolbar .markmap-toolbar button,
  .mm-markmap-toolbar .markmap-toolbar select {
    min-width: 28px;
    height: 28px;
    padding: 0 4px;
    border-radius: 6px;
    color: inherit;
  }
  .mm-markmap-toolbar .markmap-toolbar button {
    padding: 0;
  }
  .mm-markmap-toolbar .markmap-toolbar button:hover:enabled,
  .mm-markmap-toolbar .markmap-toolbar select:hover:enabled {
    background: var(--oc-hover, rgba(255, 255, 255, 0.06));
    color: var(--oc-fg, #ececf1);
  }
  .mm-markmap-toolbar .markmap-toolbar :focus-visible {
    outline: 2px solid var(--oc-focus, #6ea8fe);
    outline-offset: -2px;
    color: var(--oc-fg, #ececf1);
  }
  .mm-markmap-toolbar .markmap-toolbar svg {
    display: block;
    width: 16px;
    height: 16px;
    margin: auto;
  }
  .mm-markmap-toolbar .markmap-toolbar path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .mm-clipboard-sink {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    padding: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
    resize: none;
  }
  .mm-layout-menu {
    display: flex;
    align-items: center;
    gap: 2px;
    margin: 0;
    padding-left: 6px;
    border-left: 1px solid var(--oc-border, #34343c);
  }
  .mm-layout-button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--oc-muted, #8d8d99);
    cursor: pointer;
  }
  .mm-layout-button:hover {
    background: var(--oc-hover, rgba(255, 255, 255, 0.06));
    color: var(--oc-fg, #ececf1);
  }
  .mm-layout-button[aria-pressed="true"] {
    color: var(--oc-fg, #ececf1);
  }
  .mm-layout-button:focus-visible {
    outline: 2px solid var(--oc-focus, #6ea8fe);
    outline-offset: -2px;
    color: var(--oc-fg, #ececf1);
  }
  .mm-layout-button svg {
    display: block;
    width: 16px;
    height: 16px;
  }
  .mm-layout-button path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .mm-marker-menu {
    position: relative;
    display: flex;
    align-items: center;
    margin: 0;
    padding-left: 6px;
    border-left: 1px solid var(--oc-border, #34343c);
  }
  .mm-notes-menu {
    display: flex;
    align-items: center;
    margin: 0;
    padding-left: 6px;
    border-left: 1px solid var(--oc-border, #34343c);
  }
  .mm-group-menu {
    display: flex;
    align-items: center;
    margin: 0;
    padding-left: 6px;
    border-left: 1px solid var(--oc-border, #34343c);
  }
  .mm-marker-toolbar-button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--oc-muted, #8d8d99);
    cursor: pointer;
  }
  .mm-marker-toolbar-button:hover {
    background: var(--oc-hover, rgba(255, 255, 255, 0.06));
    color: var(--oc-fg, #ececf1);
  }
  .mm-marker-toolbar-button:focus-visible {
    outline: 2px solid var(--oc-focus, #6ea8fe);
    outline-offset: -2px;
    color: var(--oc-fg, #ececf1);
  }
  .mm-marker-toolbar-button svg {
    display: block;
    width: 16px;
    height: 16px;
  }
  .mm-marker-toolbar-button path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .mm-marker-popover {
    position: absolute;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    max-height: 380px;
    overflow-y: auto;
    background: var(--oc-elevated, #25252c);
    border: 1px solid var(--oc-border, #34343c);
    border-radius: calc(var(--oc-radius, 9px) - 1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
    user-select: none;
  }
  .mm-marker-groups {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mm-marker-category {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mm-marker-category-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--oc-muted, #8d8d99);
    padding: 0 2px;
  }
  .mm-marker-grid {
    display: grid;
    grid-template-columns: repeat(7, 26px);
    gap: 2px;
  }
  .mm-marker-button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  .mm-marker-button:hover {
    background: var(--oc-hover, rgba(255, 255, 255, 0.08));
  }
  .mm-marker-button:focus-visible {
    outline: 2px solid var(--oc-focus, #6ea8fe);
    outline-offset: -1px;
  }
  .mm-marker-remove-button {
    display: block;
    width: 100%;
    padding: 4px 6px;
    border: 0;
    border-top: 1px solid var(--oc-border, #34343c);
    border-radius: 0 0 4px 4px;
    background: transparent;
    color: var(--oc-muted, #8d8d99);
    font: 11px/1.2 var(--oc-font, system-ui, sans-serif);
    text-align: center;
    cursor: pointer;
  }
  .mm-marker-remove-button:hover {
    background: var(--oc-hover, rgba(255, 255, 255, 0.06));
    color: var(--oc-fg, #ececf1);
  }
  .mm-marker-remove-button:focus-visible {
    outline: 2px solid var(--oc-focus, #6ea8fe);
    outline-offset: -1px;
    color: var(--oc-fg, #ececf1);
  }
  .mm-notice {
    position: absolute;
    right: 12px;
    bottom: 12px;
    left: 12px;
    z-index: 5;
    padding: 7px 10px;
    border: 1px solid var(--oc-border, #34343c);
    border-radius: calc(var(--oc-radius, 9px) * 0.7);
    background: var(--oc-elevated, #25252c);
    color: var(--oc-warning-text, #f0c36a);
    font-size: 12px;
  }
  .mm-notice[hidden] { display: none; }
  .mm-error {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--oc-bg, #1b1b1f);
    color: var(--oc-muted, #8d8d99);
    text-align: center;
  }
  .mm-error p { max-width: 52ch; margin: 0; }
`;

export const ensureStyles = (target: Document): void => {
  if (target.getElementById(STYLE_ID) !== null) return;
  const style = target.createElement('style');
  style.id = STYLE_ID;
  style.textContent = MARKMAP_CSS;
  target.head.append(style);
};
