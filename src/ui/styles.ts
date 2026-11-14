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
  .mm-body {
    position: absolute;
    inset: 0;
    display: flex;
    overflow: hidden;
    background: var(--oc-bg, #1b1b1f);
  }
  .mm-stage {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
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
    z-index: 2;
  }
  .mm-source {
    box-sizing: border-box;
    flex: 0 0 clamp(220px, 30%, 420px);
    min-width: 0;
    margin: 0;
    padding: 10px 12px;
    overflow: auto;
    border: 0;
    border-left: 1px solid var(--oc-border, #34343c);
    outline: none;
    background: var(--oc-bg, #1b1b1f);
    color: var(--oc-fg, #ececf1);
    font-family: var(--oc-mono, ui-monospace, monospace);
    font-size: 12px;
    line-height: 1.5;
    resize: none;
  }
  .mm-source:focus { box-shadow: inset 0 0 0 1px var(--oc-focus, #7c6cf6); }
  .mm-source[hidden] { display: none; }
  .mm-error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--oc-bg, #1b1b1f);
    color: var(--oc-muted, #8d8d99);
    text-align: center;
  }
  .mm-error p { max-width: 52ch; margin: 0; }
  @media (max-width: 720px) {
    .mm-body { flex-direction: column; }
    .mm-source {
      flex: 0 0 35%;
      border-top: 1px solid var(--oc-border, #34343c);
      border-left: 0;
    }
  }
`;

export const ensureStyles = (target: Document): void => {
  if (target.getElementById(STYLE_ID) !== null) return;
  const style = target.createElement('style');
  style.id = STYLE_ID;
  style.textContent = MARKMAP_CSS;
  target.head.append(style);
};
