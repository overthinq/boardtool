// Tag ids, shared by the server and the browser: no Node APIs.

// "In review" → "in-review", unique among the ids in taken, which it joins.
export function newTagId(label, taken) {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tag";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}
