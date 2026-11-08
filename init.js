// Usage: node boardtool/init.js
// Creates the project folder from setup/template/, or links an existing one,
// and writes config.json. On an existing project it also updates the rules in
// its AGENTS.md files.

import { relative } from "node:path";
import {
  projectPath,
  readDefaults,
  readUserConfig,
  toolCommand,
  writeConfig,
} from "./config.js";
import {
  createProject,
  isFree,
  isProject,
  requireServerStopped,
} from "./setup/project.js";
import { ask, askDemo, requireTerminal } from "./setup/prompt.js";
import { updateRules } from "./setup/rules.js";

function fail(message) {
  console.error(message);
  process.exit(2);
}

requireTerminal();
await requireServerStopped();
const defaults = await readDefaults();
const current = await readUserConfig().catch((err) => fail(err.message));
const folder = await ask(
  "Project folder, a name next to boardtool/ or a path",
  (current ?? defaults).project,
);
const config = { ...defaults, ...current, project: folder };
const project = projectPath(config);
const shown = relative(process.cwd(), project) || ".";

if (await isProject(project)) {
  const outdated = await updateRules(project);
  await writeConfig(config);
  console.log(`Linked ${shown}.`);
  for (const { file, expected } of outdated) {
    console.log(
      expected === null
        ? `${file} has no marker line: not updated. Copy the line from ` +
            `setup/template/${file}, then run init again.`
        : `Updated the rules in ${file}.`,
    );
  }
} else if (await isFree(project)) {
  await createProject(project, { demo: await askDemo() });
  await writeConfig(config);
  console.log(`Created ${shown}.`);
} else {
  fail(`${shown} is not empty and is not a BoardTool project.`);
}
console.log(
  `Start the tool with ${toolCommand("server.js")}, the agent in ${shown}.`,
);
