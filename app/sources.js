// The files the tool reads, shared by the server, the lint and the
// screenshots, so all of them see the same project and defaults.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TIERS } from "./lib/dtcg.js";
import { parseComponent, reservedAttributes } from "./lib/jsdoc.js";
import { newTagId } from "./lib/tags.js";

export const PROJECT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../project",
);
export const DS = join(PROJECT, "ds");
export const BOARDS = join(PROJECT, "boards");
export const BOARD_DATA = join(PROJECT, "board.json");
const CONFIG = new URL("./config.json", import.meta.url);

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

// Edited by hand: errors name the file.
export async function readConfig() {
  try {
    return JSON.parse(await readFile(CONFIG, "utf8"));
  } catch (err) {
    throw new Error(`app/config.json: ${err.message}`);
  }
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
