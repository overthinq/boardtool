# BoardTool — prototyping
- Work only inside this folder. The tool lives in `../app/`: never read or edit it. Only run `node ../app/lint.js` and `node ../app/shot.js <board>`.
- `ds/tokens.css`, `ds/catalog.md` and `board.json` are written by the tool. Never edit them.
- Before working in `ds/`, read `ds/AGENTS.md`. Before working in `boards/`, read `boards/AGENTS.md`.
- One command per shell call: no `&&`, `;`, pipes or loops. Edit files with your file tools, never with `sed`.
- No npm dependencies, no frameworks, no build step.
