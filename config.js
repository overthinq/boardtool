// config.json holds the choices made with init.js on top of defaults.json.
// Git ignores it, so updating the tool never touches it.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOL = dirname(fileURLToPath(import.meta.url));
export const PORT = 4800;
const DEFAULTS = join(TOOL, "defaults.json");
const CONFIG = join(TOOL, "config.json");

// Messages name commands as they must be typed from the current folder.
export const toolCommand = (script) =>
  `node ${relative(process.cwd(), join(TOOL, script))}`;

// A relative project path starts from the folder that holds the tool.
export const projectPath = (config) => resolve(TOOL, "..", config.project);

async function readJson(file) {
  const text = await readFile(file, "utf8");
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${relative(TOOL, file)}: ${err.message}`);
  }
}

export const readDefaults = () => readJson(DEFAULTS);

// null before the first init.
export async function readUserConfig() {
  try {
    return await readJson(CONFIG);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// Defaults fill the keys a newer version of the tool added.
export async function readConfig() {
  const config = await readUserConfig();
  if (!config) {
    throw new Error(`No config.json: run ${toolCommand("init.js")}`);
  }
  return { ...(await readDefaults()), ...config };
}

export async function writeConfig(config) {
  await writeFile(CONFIG, `${JSON.stringify(config, null, 2)}\n`);
}
