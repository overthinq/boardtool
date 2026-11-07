// The project files the tool reads, shared by the server and the lint so
// both always see the same tokens and components.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TIERS } from "./lib/dtcg.js";
import { parseComponent } from "./lib/jsdoc.js";

export const PROJECT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../project",
);
export const DS = join(PROJECT, "ds");

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
      const error = api ? null : `${name}/${name}.js has no JSDoc @element`;
      return { folder: name, ...api, guide: await read("md"), error };
    }),
  );
}
