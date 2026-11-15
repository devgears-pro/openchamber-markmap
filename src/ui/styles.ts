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
  .mm-marker-menu {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
  }
  .mm-marker-select {
    padding: 4px 8px;
    border: 1px solid var(--oc-border, #34343c);
    border-radius: calc(var(--oc-radius, 9px) * 0.7);
    background: var(--oc-elevated, #25252c);
    color: var(--oc-fg, #ececf1);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .mm-marker-select:focus-visible {
    outline: 2px solid var(--oc-focus, #6ea8fe);
    outline-offset: 2px;
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
