import { getHighlightRanges } from "../core/search.js";

export function appendHighlightedText(container, text, tokens) {
  container.textContent = "";
  if (!text) return;
  if (!tokens.length) {
    container.textContent = text;
    return;
  }

  const merged = getHighlightRanges(text, tokens);
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      container.append(document.createTextNode(text.slice(cursor, start)));
    }
    const mark = document.createElement("mark");
    mark.className = "search-highlight";
    mark.textContent = text.slice(start, end);
    container.append(mark);
    cursor = end;
  }
  if (cursor < text.length) {
    container.append(document.createTextNode(text.slice(cursor)));
  }
}

export function reconcile(container, nodes) {
  const wanted = new Set(nodes);
  for (const child of [...container.children]) {
    if (!wanted.has(child)) child.remove();
  }
  nodes.forEach((node, index) => {
    const current = container.children[index];
    if (current !== node) container.insertBefore(node, current ?? null);
  });
}

export function createKeyedCache() {
  let previous = new Map();
  let next = new Map();
  return {
    clear() {
      previous = new Map();
      next = new Map();
    },
    begin() {
      next = new Map();
    },
    get(key, signature, create) {
      const hit = previous.get(key);
      const entry = hit && hit.signature === signature ? hit : { signature, node: create() };
      next.set(key, entry);
      return entry.node;
    },
    end() {
      previous = next;
    },
  };
}
