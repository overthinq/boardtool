// The AGENTS.md files of a project. Above the marker line: the rules of
// setup/template/ with the tool's path in place of {TOOL}. Below: the user's.

import { readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { TOOL } from "../config.js";

export const TEMPLATE = join(TOOL, "setup", "template");
const MARKER =
  "<!-- BoardTool writes the rules above this line. Add your own below it. -->";
const FILES = ["AGENTS.md", "ds/AGENTS.md", "boards/AGENTS.md"];

async function toolRules(project, file) {
  const template = await readFile(join(TEMPLATE, file), "utf8");
  const tool = relative(project, TOOL).split(sep).join("/");
  return template.slice(0, template.indexOf(MARKER)).replaceAll("{TOOL}", tool);
}

// expected is the text the file should hold, null when the user removed the
// marker line and the two parts can no longer be told apart.
async function ruleFile(project, file) {
  const path = join(project, file);
  const text = await readFile(path, "utf8").catch((err) => {
    if (err.code === "ENOENT") return null;
    throw err;
  });
  if (text !== null && !text.includes(MARKER)) {
    return { file, path, text, expected: null };
  }
  const own = text === null ? `${MARKER}\n` : text.slice(text.indexOf(MARKER));
  const expected = (await toolRules(project, file)) + own;
  return { file, path, text, expected };
}

export async function outdatedRules(project) {
  const files = await Promise.all(FILES.map((file) => ruleFile(project, file)));
  return files.filter(({ text, expected }) => text !== expected);
}

// Returns the outdated files; those without the marker stay as they are.
export async function updateRules(project) {
  const outdated = await outdatedRules(project);
  for (const { path, expected } of outdated) {
    if (expected !== null) await writeFile(path, expected);
  }
  return outdated;
}
