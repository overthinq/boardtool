# Board rules
- Before editing a board, read its note in `board.json` (`boards` → `<page>/<file>`), if it has one.
- Pages are folders in `boards/` (one level). New board: `cp boards/_template.html boards/<page>/<nn>-<name>.html`, then edit `<main>` only.
- Read `ds/catalog.md` before composing. Use only listed components and tokens.
- No inline styles, no `<style>` blocks, no hardcoded colors or sizes.
- Missing component or token? Stop and ask. Never improvise one inside a board.
- Interactive elements are native (`<button>`, `<input>`, `<dialog>`).
- Asset paths are absolute from server root (`/ds/...`).
- After a batch of boards, not after each one: `node {TOOL}/lint.js` checks the whole project. Fix every error.
- Look at the board when it is done and after a fix, not after every edit: `node {TOOL}/shot.js boards/<page>/<file>` saves a screenshot at the board's frame size and prints its path; read that image. Add `--height N` only to see below the frame. A browser tool of your own works too.
<!-- BoardTool writes the rules above this line. Add your own below it. -->
