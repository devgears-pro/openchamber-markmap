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
  }
  .mm-markmap-toolbar {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 5px;
    border: 1px solid var(--oc-border, #34343c);
    border-radius: calc(var(--oc-radius, 9px) + 5px);
    background: var(--oc-elevated, #25252c);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
  }
  .mm-markmap-toolbar > .markmap-toolbar {
    gap: 2px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .mm-markmap-toolbar .markmap-toolbar button,
  .mm-markmap-toolbar .markmap-toolbar select {
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    border-radius: 8px;
  }
  .mm-markmap-toolbar .markmap-toolbar button:hover:enabled,
  .mm-markmap-toolbar .markmap-toolbar select:hover:enabled {
    background: var(--oc-hover, rgba(255, 255, 255, 0.06));
  }
  .mm-markmap-toolbar .markmap-toolbar :focus-visible {
    outline: 2px solid var(--oc-focus, #6ea8fe);
    outline-offset: -2px;
  }
  .mm-markmap-toolbar .markmap-toolbar svg {
    width: 18px;
    height: 18px;
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
    padding-left: 4px;
    border-left: 1px solid var(--oc-border, #34343c);
  }
  .mm-layout-button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--oc-fg, #ececf1);
    cursor: pointer;
  }
  .mm-layout-button:hover {
    background: var(--oc-hover, rgba(255, 255, 255, 0.06));
  }
  .mm-layout-button[aria-pressed="true"] {
    background: var(--oc-selection, rgba(110, 168, 254, 0.18));
    color: var(--oc-fg, #ececf1);
  }
  .mm-layout-button:focus-visible {
    outline: 2px solid var(--oc-focus, #6ea8fe);
    outline-offset: -2px;
  }
  .mm-layout-button svg {
    display: block;
    width: 18px;
    height: 18px;
  }
  .mm-layout-button path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .mm-marker-menu {
    position: relative;
    display: flex;
    align-items: center;
    margin: 0;
    padding-left: 4px;
    border-left: 1px solid var(--oc-border, #34343c);
  }
  .mm-notes-menu {
    display: flex;
    align-items: center;
    margin: 0;
    padding-left: 4px;
    border-left: 1px solid var(--oc-border, #34343c);
  }
  .mm-marker-select {
    position: relative;
    z-index: 1;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: transparent;
    font: 15px/1 var(--oc-font, system-ui, sans-serif);
    appearance: none;
    cursor: pointer;
  }
  .mm-marker-select:hover {
    background: var(--oc-hover, rgba(255, 255, 255, 0.06));
  }
  .mm-marker-select:focus {
    color: var(--oc-fg, #ececf1);
  }
  .mm-marker-select option {
    background: var(--oc-elevated, #25252c);
    color: var(--oc-fg, #ececf1);
  }
  .mm-marker-menu svg {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: 18px;
    height: 18px;
    margin: auto;
    color: var(--oc-fg, #ececf1);
    pointer-events: none;
  }
  .mm-marker-menu path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .mm-marker-select:focus-visible {
    outline: 2px solid var(--oc-focus, #6ea8fe);
    outline-offset: -2px;
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
