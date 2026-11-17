const CHAT_STYLE_ID = 'markmap-chat-styles';

const CHAT_CSS = `
  html, body, #root { height: 100%; }
  html, body {
    margin: 0;
    background: var(--oc-bg, #1b1b1f);
    color: var(--oc-fg, #ececf1);
    font-family: var(--oc-font, system-ui, -apple-system, "Segoe UI", sans-serif);
    font-size: 13px;
  }
  .mm-chat-map {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .mm-chat-svg {
    display: block;
    width: 100%;
    height: 100%;
    background: transparent;
    --mm-edge-relation: var(--oc-muted, #8b949e);
    --mm-edge-relation-label: var(--oc-fg, #ececf1);
  }
  .mm-chat-notice {
    position: absolute;
    right: 8px;
    bottom: 8px;
    left: 8px;
    margin: 0;
    padding: 6px 9px;
    border: 1px solid var(--oc-border, #34343c);
    border-radius: 6px;
    background: var(--oc-elevated, #25252c);
    color: var(--oc-warning-text, #f0c36a);
    font-size: 12px;
    line-height: 1.4;
  }
  .mm-chat-notice[hidden] { display: none; }
`;

export const ensureChatStyles = (target: Document): void => {
  if (target.getElementById(CHAT_STYLE_ID) !== null) return;
  const style = target.createElement('style');
  style.id = CHAT_STYLE_ID;
  style.textContent = CHAT_CSS;
  target.head.append(style);
};
