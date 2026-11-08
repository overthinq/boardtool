// Usage: node boardtool/reset.js
// Sets the project folder aside as <name>.old-<date>-<time> and creates a new
// one in its place. Only the user deletes the old folder.

import { basename, relative } from "node:path";
import {
  createProject,
  requireServerStopped,
  setAside,
} from "./setup/project.js";
import { ask, askDemo, requireTerminal } from "./setup/prompt.js";
import { PROJECT } from "./sources.js";

requireTerminal();
await requireServerStopped();
const name = basename(PROJECT);
const shown = relative(process.cwd(), PROJECT) || ".";
console.log(
  `${shown} will be renamed to ${name}.old-<date>-<time> and replaced by a ` +
    "new project.",
);
if ((await ask(`Type ${name} to confirm`)) !== name) {
  console.log("Not confirmed: nothing changed.");
  process.exit(1);
}
const demo = await askDemo();
const old = await setAside(PROJECT);
await createProject(PROJECT, { demo });
console.log(`Moved the old project to ${relative(process.cwd(), old)}.`);
console.log("Created a new project.");
