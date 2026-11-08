// Questions in the terminal, for the commands that set up a project.

import { createInterface } from "node:readline/promises";

// Agents run commands without a terminal: only a person may answer.
export function requireTerminal() {
  if (process.stdin.isTTY) return;
  console.error("This command asks questions: run it yourself in a terminal.");
  process.exit(2);
}

export async function ask(question, fallback = "") {
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const hint = fallback ? ` (${fallback})` : "";
  try {
    const answer = await terminal.question(`${question}${hint}: `);
    return answer.trim() || fallback;
  } catch (err) {
    // Ctrl+C: stop quietly, before anything is written.
    if (err.code !== "ABORT_ERR") throw err;
    console.log();
    process.exit(130);
  } finally {
    terminal.close();
  }
}

export async function confirm(question) {
  return /^y(es)?$/i.test(await ask(`${question} [y/N]`));
}

export const askDemo = () =>
  confirm("Add the demo: a small design system and two boards?");
