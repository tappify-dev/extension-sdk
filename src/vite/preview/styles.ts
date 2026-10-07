export const previewStyles = `
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f2f3ee;
  color: #121212;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; background: #f2f3ee; }
button, select { font: inherit; }
.tap-preview {
  --preview-canvas: #f2f3ee;
  --preview-paper: #fdfdfd;
  --preview-ink: #121212;
  --preview-muted: #686b66;
  --preview-border: #d5d7d1;
  --preview-control: #f7f8f4;
  --preview-green: #235027;
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--preview-canvas);
  color: var(--preview-ink);
}
.tap-preview[data-theme="dark"] {
  color-scheme: dark;
  --preview-canvas: #111216;
  --preview-paper: #181920;
  --preview-ink: #f4f5f1;
  --preview-muted: #a7aaa4;
  --preview-border: #303239;
  --preview-control: #202229;
  --preview-green: #b4d773;
}
.tap-preview-bar {
  min-height: 68px;
  display: flex;
  gap: 24px;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--preview-border);
  background: var(--preview-paper);
}
.tap-preview-brand { min-width: 210px; margin-right: auto; display: flex; align-items: center; gap: 10px; }
.tap-preview-brand img { width: 36px; height: 36px; flex: 0 0 auto; object-fit: cover; border: 1px solid var(--preview-border); border-radius: 8px; background: #fff; }
.tap-preview-brand strong, .tap-preview-brand span { display: block; }
.tap-preview-brand strong { font-size: 14px; font-weight: 650; letter-spacing: -0.01em; }
.tap-preview-brand span { margin-top: 2px; color: var(--preview-muted); font-size: 11px; }
.tap-preview-brand i { width: 6px; height: 6px; display: inline-block; margin-right: 6px; border-radius: 50%; background: #64a75f; box-shadow: 0 0 0 2px rgb(100 167 95 / 14%); }
.tap-preview-controls { display: flex; align-items: end; gap: 8px; }
.tap-preview-field { min-width: 104px; display: grid; gap: 4px; color: var(--preview-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.045em; text-transform: uppercase; }
.tap-preview-field--contribution { min-width: 190px; }
.tap-preview-field select, .tap-preview-reset {
  height: 32px;
  border: 1px solid var(--preview-border);
  border-radius: 6px;
  outline: none;
  background: var(--preview-control);
  color: var(--preview-ink);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: normal;
  text-transform: none;
}
.tap-preview-field select { width: 100%; padding: 0 28px 0 9px; cursor: pointer; }
.tap-preview-field select:focus, .tap-preview-reset:focus-visible { border-color: var(--preview-green); box-shadow: 0 0 0 2px color-mix(in srgb, var(--preview-green) 18%, transparent); }
.tap-preview-reset { padding: 0 12px; cursor: pointer; }
.tap-preview-reset:hover { border-color: color-mix(in srgb, var(--preview-ink) 34%, var(--preview-border)); background: var(--preview-paper); }
.tap-preview-stage { min-width: 0; padding: 22px 24px 14px; overflow: auto; }
.tap-preview-canvas {
  width: 100%;
  max-width: 1440px;
  height: max(380px, calc(100vh - 118px));
  margin: 0 auto;
  border: 1px solid var(--preview-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--preview-paper);
  color: var(--preview-ink);
  box-shadow: 0 2px 8px rgb(20 24 18 / 5%);
  transition: max-width 160ms ease;
}
.tap-preview-canvas[data-viewport="tablet"] { max-width: 768px; }
.tap-preview-canvas[data-viewport="mobile"] { max-width: 390px; }
.tap-preview-canvas[data-size="slot"] { width: min(100%, 680px); height: 380px; }
.tap-preview-canvas[data-size="panel"] { width: min(100%, 960px); height: clamp(420px, calc(100vh - 118px), 620px); }
.tap-preview-canvas[data-size="page"] { height: max(380px, calc(100vh - 118px)); }
.tap-preview-surface { display: block; height: 100%; min-height: 0; }
.tap-preview-message { min-height: 360px; display: grid; place-content: center; gap: 8px; padding: 32px; text-align: center; }
.tap-preview-message span { max-width: 62ch; color: var(--preview-muted); }
@media (max-width: 640px) {
  .tap-preview-stage { padding: 12px; }
  .tap-preview-bar { align-items: flex-start; padding: 12px; }
  .tap-preview-brand { min-width: 0; }
  .tap-preview-controls { width: 100%; overflow-x: auto; padding-bottom: 2px; }
  .tap-preview-field { min-width: 100px; }
  .tap-preview-field--contribution { min-width: 180px; }
}
@media (max-width: 900px) {
  .tap-preview-bar { flex-wrap: wrap; gap: 12px; }
  .tap-preview-controls { flex: 1 1 100%; }
}
`;
