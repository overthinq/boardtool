// Creating, recognising and setting aside a project folder.

import { cp, readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { PORT, TOOL } from "../config.js";
import { TEMPLATE, updateRules } from "./rules.js";

const DEMO = join(TOOL, "setup", "demo");

const isDirectory = (path) =>
  stat(path).then(
    (stats) => stats.isDirectory(),
    () => false,
  );

export async function isProject(dir) {
  return (
    (await isDirectory(join(dir, "boards"))) &&
    (await isDirectory(join(dir, "ds")))
  );
}

// The server watches the project folder it found at start: changing the
// folder under it would leave it on the old one.
export async function requireServerStopped() {
  const isRunning = await fetch(`http://127.0.0.1:${PORT}/__app/`).then(
    () => true,
    () => false,
  );
  if (!isRunning) return;
  console.error("The server is running: stop it with Ctrl+C in its terminal.");
  process.exit(2);
}

// A missing folder is free too: creating the project creates it.
export async function isFree(dir) {
  try {
    return (await readdir(dir)).length === 0;
  } catch (err) {
    if (err.code === "ENOENT") return true;
    throw err;
  }
}

// The demo replaces the empty design system files of the template.
export async function createProject(dir, { demo }) {
  await cp(TEMPLATE, dir, { recursive: true });
  if (demo) await cp(DEMO, dir, { recursive: true });
  await updateRules(dir);
}

// Renames the folder to <name>.old-<date>-<time>; deleting it is up to the
// user. The sv-SE locale writes the local date and time as "2026-11-08 15:30:12".
export async function setAside(dir) {
  const stamp = new Date()
    .toLocaleString("sv-SE")
    .replace(" ", "-")
    .replaceAll(":", "");
  const old = `${dir}.old-${stamp}`;
  await rename(dir, old);
  return old;
}
