// Serving project files, shared by the server and the screenshots.

import { STATUS_CODES } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

export function reply(
  res,
  status,
  body = STATUS_CODES[status],
  type = "text/plain; charset=utf-8",
) {
  // Boards must always reflect the files on disk, also after a live reload.
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

export async function serveFile(res, root, path) {
  const target = path.endsWith("/") ? path + "index.html" : path;
  const file = resolve(root, "." + target);
  // Never serve anything outside root, whatever the URL contains.
  if (!file.startsWith(root + sep)) return reply(res, 404);
  try {
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    reply(res, 200, await readFile(file), type);
  } catch (err) {
    if (["ENOENT", "EISDIR", "ENOTDIR"].includes(err.code)) {
      return reply(res, 404);
    }
    throw err;
  }
}
