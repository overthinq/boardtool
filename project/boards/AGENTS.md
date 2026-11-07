# Board rules
- Before editing a board, read its note in `board.json` (`boards` → `<page>/<file>`), if it has one.
- Pages are folders in `boards/` (one level). New board: `cp boards/_template.html boards/<page>/<nn>-<name>.html`, then edit `<main>` only.
- Read `ds/catalog.md` before composing. Use only listed components and tokens.
- No inline styles, no `<style>` blocks, no hardcoded colors or sizes.
- Missing component or token? Stop and ask. Never improvise one inside a board.
- Interactive elements are native (`<button>`, `<input>`, `<dialog>`).
- Asset paths are absolute from server root (`/ds/...`).
- After writing: `node ../app/lint.js boards/<page>/<file>`. Fix every error.
