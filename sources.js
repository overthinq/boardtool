// The files the tool reads, shared by the server, the lint and the
// screenshots, so all of them see the same project and defaults.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { projectPath, readConfig, toolCommand } from "./config.js";
import { TIERS } from "./lib/dtcg.js";
import { parseComponent, reservedAttributes } from "./lib/jsdoc.js";
import { newTagId } from "./lib/tags.js";
import { isProject } from "./setup/project.js";

async function findProject() {
  const project = projectPath(await readConfig());
  if (await isProject(project)) return project;
  const shown = relative(process.cwd(), project) || ".";
  throw new Error(
    `No project in ${shown}: run ${toolCommand("init.js")} to create it, ` +
      "or to link the folder if you moved it",
  );
}

// Every command needs the project: without it, say how to set it up.
export const PROJECT = await findProject().catch((err) => {
  console.error(err.message);
  process.exit(2);
});
export const DS = join(PROJECT, "ds");
export const BOARDS = join(PROJECT, "boards");
export const BOARD_DATA = join(PROJECT, "board.json");

export const byName = (a, b) =>
  a.name.localeCompare(b.name, "en", { numeric: true });
export const isListed = (entry) => !/^[._]/.test(entry.name);

export async function readTokenFiles() {
  const files = [];
  for (const tier of TIERS) {
    const dir = join(DS, "tokens", tier);
    const names = (await readdir(dir)).filter((name) =>
      name.endsWith(".tokens.json"),
    );
    for (const name of names.sort()) {
      const text = await readFile(join(dir, name), "utf8");
      try {
        files.push({ tier, name: `${tier}/${name}`, json: JSON.parse(text) });
      } catch (err) {
        throw new Error(`${tier}/${name}: ${err.message}`);
      }
    }
  }
  return files;
}

function reservedError(component) {
  const names = reservedAttributes(component);
  if (!names.length) return null;
  const list = names.join(", ");
  return `Attributes named like HTML attributes, rename them: ${list}`;
}

// One folder per component: <name>/<name>.js with the JSDoc, <name>.md with
// the guidelines.
export async function readComponents() {
  const dir = join(DS, "components");
  const entries = await readdir(dir, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory() && isListed(entry))
    .sort(byName);
  return Promise.all(
    folders.map(async ({ name }) => {
      const read = (extension) =>
        readFile(join(dir, name, `${name}.${extension}`), "utf8").catch(
          () => "",
        );
      const api = parseComponent(await read("js"));
      const error = api
        ? reservedError(api)
        : `${name}/${name}.js has no JSDoc @element`;
      return { folder: name, ...api, guide: await read("md"), error };
    }),
  );
}

export async function readBoardData() {
  try {
    return JSON.parse(await readFile(BOARD_DATA, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    const { tags } = await readConfig();
    const taken = new Set();
    const labelled = tags.map((label) => ({
      id: newTagId(label, taken),
      label,
    }));
    return { version: 1, tags: labelled, pages: {}, boards: {} };
  }
}
