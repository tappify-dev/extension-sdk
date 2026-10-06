export const previewStyles = `
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #f4f5ef;
  color: #142012;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
button, select { font: inherit; }
.tap-preview { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
.tap-preview[data-theme="dark"] { color-scheme: dark; background: #111710; color: #f2f5ec; }
.tap-preview-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; padding: 16px 20px; border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent); background: color-mix(in srgb, Canvas 94%, transparent); }
.tap-preview-brand { margin-right: auto; min-width: 190px; }
.tap-preview-brand strong, .tap-preview-brand span { display: block; }
.tap-preview-brand span, .tap-preview-note { color: color-mix(in srgb, currentColor 62%, transparent); font-size: 12px; }
.tap-preview-field { display: grid; gap: 5px; font-size: 12px; }
.tap-preview-field select, .tap-preview-reset { min-height: 34px; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 7px; background: Canvas; color: CanvasText; padding: 6px 9px; }
.tap-preview-reset { cursor: pointer; }
.tap-preview-stage { padding: 24px; overflow: auto; }
.tap-preview-canvas { width: 100%; min-height: 520px; margin: 0 auto; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 12px; background: Canvas; color: CanvasText; box-shadow: 0 12px 36px rgb(20 32 18 / 9%); transition: max-width 160ms ease; }
.tap-preview-canvas[data-viewport="tablet"] { max-width: 768px; }
.tap-preview-canvas[data-viewport="mobile"] { max-width: 390px; }
.tap-preview-surface { min-height: 100%; padding: 24px; }
.tap-preview-message { min-height: 360px; display: grid; place-content: center; gap: 8px; padding: 32px; text-align: center; }
.tap-preview-message span { max-width: 62ch; color: color-mix(in srgb, currentColor 68%, transparent); }
@media (max-width: 640px) {
  .tap-preview-stage { padding: 12px; }
  .tap-preview-bar { padding: 12px; }
}
`;
